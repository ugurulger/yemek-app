import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import PreferencesScreen from '@/components/recipes/PreferencesScreen';
import RecipeList from '@/components/recipes/RecipeList';
import RecipeLayerSections, {
  type RecipeCardSlot,
  type RecipeDisplaySection,
} from '@/components/recipes/RecipeLayerSections';
import RecipeSkeletonCard from '@/components/recipes/RecipeSkeletonCard';
import {
  generateFineDiningDetail,
  generateRecipeDetail,
  generateRecipesTwoPhase,
  mergeRecipeLayers,
  RecipeGenerationError,
  type RecipeLayerId,
} from '@/lib/claude/generateRecipes';
import { generateRecipesRag, RAG_ENABLED } from '@/lib/rag/generateRecipesRag';
import { getAppLanguage, llmOutputLanguage } from '@/src/i18n';
import { pantryPromptNames } from '@/src/i18n/inventoryI18n';
import { ensureRecipeTranslations, useLocalizedRecipes } from '@/src/i18n/recipeI18n';
import { cardShadow, colors } from '@/lib/theme';
import { useInventoryStore } from '@/store/inventoryStore';
import { usePantryStore } from '@/store/pantryStore';
import { inventoryFingerprint, useRecipeStore } from '@/store/recipeStore';
import type { Recipe } from '@/types/recipe';

// İş 1: 6 standart + 2 fine dining = 8 (iskelet satır sayısı bunun yarısı).
const PLANNED_RECIPE_COUNT = 8;

/** Yenile butonu gölgesi — birebir referans: 0 4px 12px -5px rgba(31,74,61,.3). */
const REFRESH_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 6,
  elevation: 3,
} as const;

interface RecipeSlotState {
  name: string;
  /** Aşama 1'in hedefi — detay çağrısının varyantını ve ön bölüm yerleşimini belirler. */
  estimatedLayer: RecipeLayerId;
  /** İş 1: fine dining slotu — kendi bölümünde gösterilir, retry'ı fine dining detayını çağırır. */
  fineDining: boolean;
  status: 'loading' | 'done' | 'error';
  recipe: Recipe | null;
  /** Aşama 2 dönünce eksik malzeme sayısından KODDA hesaplanan kesin katman — bkz. `assignRecipeLayer`. */
  actualLayer: RecipeLayerId | null;
}

function layerForSlot(slot: RecipeSlotState): RecipeLayerId | null {
  return slot.status === 'done' ? slot.actualLayer : slot.estimatedLayer;
}

/** Alışveriş bölümü sıralaması: dolan kartlar gerçek eksik sayısına göre,
 * yüklenenler tahmini katmanlarına göre kaba sıraya girer (stable sort —
 * eşitlikte plan sırası korunur). */
function shoppingSortKey(slot: RecipeSlotState): number {
  if (slot.status === 'done' && slot.recipe) return slot.recipe.missing_count;
  return slot.estimatedLayer === 'closeMatch' ? 1.5 : 3.5;
}

export default function TariflerScreen() {
  const { t } = useTranslation();
  const inventoryItems = useInventoryStore((state) => state.items);
  const pantryItems = usePantryStore((state) => state.items);
  const recipes = useRecipeStore((state) => state.recipes);
  // Dil değişiminde "topyekün" takas: liste, aktif dile yerelleştirilmiş
  // kopyalarla gösterilir (çeviri hazır değilse orijinal dil — bkz.
  // src/i18n/recipeI18n.ts + languageSync.ts).
  const displayRecipes = useLocalizedRecipes(recipes);
  const setRecipes = useRecipeStore((state) => state.setRecipes);
  const preferences = useRecipeStore((state) => state.preferences);
  const generatedForFingerprint = useRecipeStore((state) => state.generatedForFingerprint);

  const [isGenerating, setIsGenerating] = useState(false);
  /** Listeden yenile butonu ile tercih ekranına dönüş (görsel 05/06 → 07 akışı). */
  const [showPreferences, setShowPreferences] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slots, setSlots] = useState<RecipeSlotState[]>([]);

  const activePantryItems = pantryItems.filter((item) => item.active);
  // Bulgu 1 (analysis/rag-analysis.md §7b): prompta giden kiler adları çıktı
  // DİLİNDE olmalı — TR adlar İngilizce üretimde sahte eksik yaratıyordu.
  // Varsayılanlar statik i18n etiketiyle, kullanıcı eklemeleri nameTr/nameEn
  // alanlarıyla çevrilir (LLM çağrısı yok); RAG yolu item listesini alır ve
  // kendi içinde her zaman İngilizce'ye çevirir.
  const promptPantryNames = () =>
    pantryPromptNames(activePantryItems, llmOutputLanguage() === 'Turkish' ? 'tr' : 'en');

  async function handleGenerateRecipes() {
    // Önbellek kuralı: envanter + tercihler değişmediyse tarifler yeniden
    // üretilmez, AsyncStorage'dan hidrate edilen mevcut liste kullanılmaya
    // devam eder. AKTİF KİLER parmak izine BİLİNÇLİ olarak dahil değil
    // (kullanıcı kararı): kiler güncellemesi üretimi baştan başlatmaz,
    // yalnızca eksik rozetleri canlı güncellenir (RecipeList — computeMissing).
    const fingerprint = inventoryFingerprint(inventoryItems, preferences);
    setShowPreferences(false);
    if (recipes.length > 0 && generatedForFingerprint === fingerprint) {
      setErrorMessage(null);
      return;
    }

    setErrorMessage(null);
    setSlots([]);
    setIsGenerating(true);
    try {
      // RAG feature flag (BLOK A / A6): EXPO_PUBLIC_USE_RAG=true iken üretim
      // Supabase edge function'ına gider (tek çağrı, canlı slot gösterimi yok —
      // ekran genel iskeletlerde bekler); kapalıyken mevcut akış AYNEN çalışır.
      const merged = RAG_ENABLED
        ? await generateRecipesRag(inventoryItems, { preferences, activePantry: activePantryItems })
        : await generateRecipesTwoPhase(inventoryItems, {
        // Tercihler + aktif kiler üretim promptuna girer (servis kontratı —
        // bkz. services/contracts.ts, GenerateRecipesOptions).
        preferences,
        activePantryNames: promptPantryNames(),
        // Çıktı dili aktif uygulama dilinden (BLOK B / B3).
        outputLanguage: llmOutputLanguage(),
        // Aşama 1 (isim/plan) döner dönmez 6 slot oluşturulur — her biri
        // isim + tahmini katmanla birlikte "detay yükleniyor" durumunda başlar.
        onPlanReady: (plans) => {
          setSlots(
            plans.map((plan) => ({
              name: plan.name,
              estimatedLayer: plan.estimatedLayer,
              fineDining: plan.fineDining === true,
              status: 'loading',
              recipe: null,
              actualLayer: null,
            }))
          );
        },
        // Her detay TAMAMLANDIĞI ANDA (diğerlerini beklemeden) o slot tek
        // başına güncellenir — kartlar tek tek dolar (canlı akış hissi).
        onDetailSettled: (result) => {
          setSlots((prev) =>
            prev.map((slot, index) =>
              index === result.planIndex
                ? {
                    ...slot,
                    status: result.status,
                    recipe: result.recipe ?? null,
                    actualLayer: result.layer ?? null,
                  }
                : slot
            )
          );
        },
      });
      setRecipes(merged, fingerprint);
      // Dil politikası (lib/rag/generateRecipesRag.ts): RAG yolu HEP
      // İngilizce üretir; uygulama dili TR ise çeviriler burada arka planda
      // başlatılır — hazır olan tarif useLocalizedRecipes ile kendiliğinden
      // TR'ye döner, o ana kadar EN gösterilir. İki aşamalı yol aktif dilde
      // ürettiği için bu çağrı onda no-op olurdu; yine de RAG'e sınırlandı.
      if (RAG_ENABLED && getAppLanguage() !== 'en') {
        void ensureRecipeTranslations(getAppLanguage());
      }
    } catch (error) {
      // Domain hata mesajları (lib/claude) Türkçe teknik metinler — UI tam
      // yerelleşsin diye ekranda genel çevrilmiş mesaj gösterilir, orijinali
      // console'a düşer (lib modülleri Node script'lerinden de kullanıldığı
      // için i18n lib'e SOKULMAZ — ekran sınırı kararı, BLOK B).
      console.warn('[recipes] üretim hatası:', error);
      setErrorMessage(t('errors.recipeGenerationFailed'));
    } finally {
      setIsGenerating(false);
    }
  }

  async function retrySlot(index: number) {
    const slot = slots[index];
    if (!slot) return;

    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, status: 'loading' } : s)));
    try {
      const context = {
        preferences,
        activePantryNames: promptPantryNames(),
        outputLanguage: llmOutputLanguage(),
      };
      // Fine dining slotunun retry'ı kendi varyantını kullanır (İş 1).
      const { recipe, layer } = slot.fineDining
        ? await generateFineDiningDetail(slot.name, inventoryItems, context)
        : await generateRecipeDetail(slot.name, inventoryItems, slot.estimatedLayer, context);
      const nextSlots = slots.map((s, i) =>
        i === index ? { ...s, status: 'done' as const, recipe, actualLayer: layer } : s
      );
      setSlots(nextSlots);
      const doneRecipes = nextSlots
        .filter((s) => s.status === 'done' && s.actualLayer !== null && s.recipe)
        .map((s) => s.recipe as Recipe);
      const merged = mergeRecipeLayers([doneRecipes]);
      if (merged.length > 0) {
        setRecipes(merged, inventoryFingerprint(inventoryItems, preferences));
      }
    } catch {
      setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, status: 'error' } : s)));
    }
  }

  const hasInventory = inventoryItems.length > 0;
  const fingerprint = inventoryFingerprint(inventoryItems, preferences);
  // Cache eşleşiyorsa doğrudan liste; eşleşmiyorsa (veya liste boşsa) önce
  // tercih ekranı gösterilir (spec §4 akışı).
  const cacheValid = recipes.length > 0 && generatedForFingerprint === fingerprint;
  // Aşama 1 henüz dönmedi: slot yok, sadece isimsiz genel iskeletler gösterilir.
  const isPlanning = isGenerating && slots.length === 0;

  const cardSlots: RecipeCardSlot[] = slots.map((slot, index) => ({
    key: `slot-${index}`,
    name: slot.name,
    status: slot.status,
    recipe: slot.recipe,
    onRetry: () => retrySlot(index),
  }));

  const sections: RecipeDisplaySection[] = [
    {
      key: 'ready',
      title: t('recipes.sectionReady'),
      prominent: true,
      slots: cardSlots.filter((_, i) => !slots[i].fineDining && layerForSlot(slots[i]) === 'ready'),
    },
    {
      key: 'shopping',
      title: t('recipes.sectionShopping'),
      prominent: false,
      slots: cardSlots
        .map((cardSlot, i) => ({ cardSlot, slot: slots[i] }))
        .filter(({ slot }) => {
          if (slot.fineDining) return false;
          const layer = layerForSlot(slot);
          return layer === 'closeMatch' || layer === 'fewMissing';
        })
        .sort((a, b) => shoppingSortKey(a.slot) - shoppingSortKey(b.slot))
        .map(({ cardSlot }) => cardSlot),
    },
    // İş 1: fine dining slotları eksik-bazlı bölümlemeye karışmaz — üretim
    // sırasında da kendi bölümünde görünürler (RecipeList ile tutarlı).
    {
      key: 'fineDining',
      title: t('recipes.sectionFineDining'),
      prominent: false,
      slots: cardSlots.filter((_, i) => slots[i].fineDining),
    },
  ].filter((section) => section.slots.length > 0);

  // Tercih ekranı: üretim yokken cache geçersizse veya kullanıcı yenile ile
  // dönmek istediyse (envanter varken).
  const showPreferencesScreen = hasInventory && !isGenerating && (showPreferences || !cacheValid);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      {errorMessage && (
        <View className="mx-5 mb-2 mt-2 rounded-2xl bg-white px-4 py-3" style={cardShadow}>
          <Text className="font-sans-medium text-sm text-red-500">{errorMessage}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleGenerateRecipes}
            className="mt-2 self-start active:scale-95">
            <Text className="font-sans-medium text-sm text-forest">{t('common.retry')}</Text>
          </Pressable>
        </View>
      )}

      {!hasInventory ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-full items-center rounded-2xl bg-white p-8" style={cardShadow}>
            <Text className="text-5xl">🍲</Text>
            <Text className="mt-4 text-center font-serif text-[21px] text-ink">
              {t('recipes.emptyTitle')}
            </Text>
            <Text className="mt-2 text-center font-sans text-sm text-muted">
              {t('recipes.emptyBody')}
            </Text>
          </View>
        </View>
      ) : showPreferencesScreen ? (
        <PreferencesScreen onNext={handleGenerateRecipes} />
      ) : (
        <>
          {/* Liste başlığı — birebir referans: eyebrow 400 13px muted ls .3;
              h1 Newsreader 500 34px forest (margin 2px üst); yenile 46×46
              beyaz daire, gölge 0 4px 12px -5px rgba(31,74,61,.3), ikon 19. */}
          <View className="flex-row items-start justify-between px-5 pt-2">
            <View>
              <Text className="font-sans text-[13px] text-muted" style={{ letterSpacing: 0.3 }}>
                {t('recipes.eyebrow')}
              </Text>
              <Text className="mt-0.5 font-serif text-[34px] leading-[40px] text-forest">
                {t('recipes.title')}
              </Text>
            </View>
            {!isGenerating && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('recipes.refreshA11y')}
                onPress={() => setShowPreferences(true)}
                className="h-[46px] w-[46px] items-center justify-center rounded-full bg-white active:scale-95"
                style={REFRESH_SHADOW}>
                <Ionicons name="refresh" size={19} color={colors.forest} />
              </Pressable>
            )}
          </View>

          {isPlanning ? (
            <View className="flex-1 px-5">
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120, paddingTop: 8, gap: 14 }}>
                {Array.from({ length: PLANNED_RECIPE_COUNT / 2 }).map((_, rowIndex) => (
                  <View key={rowIndex} className="flex-row gap-[14px]">
                    <View className="flex-1">
                      <RecipeSkeletonCard />
                    </View>
                    <View className="flex-1">
                      <RecipeSkeletonCard />
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : isGenerating ? (
            <View className="flex-1 px-5">
              <RecipeLayerSections
                sections={sections}
                onPressRecipe={(id) => router.push(`/recipe/${id}`)}
              />
            </View>
          ) : (
            <View className="flex-1 px-5">
              <RecipeList
                recipes={displayRecipes}
                onPressRecipe={(id) => router.push(`/recipe/${id}`)}
              />
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}
