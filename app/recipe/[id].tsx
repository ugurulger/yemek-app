import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { askChef } from '@/lib/claude/askChef';
import ChefChat from '@/components/recipes/detail/ChefChat';
import CookbookPickerSheet from '@/components/recipes/detail/CookbookPickerSheet';
import IngredientRow from '@/components/recipes/detail/IngredientRow';
import PlanDayPickerSheet from '@/components/recipes/detail/PlanDayPickerSheet';
import ServingsStepper from '@/components/recipes/detail/ServingsStepper';
import RecipeHeroImage from '@/components/recipes/RecipeHeroImage';
import { Card, MissingBadge } from '@/components/ui';
import { buildCartMissingInput } from '@/lib/recipes/cart-helpers';
import { useRecipeById } from '@/lib/recipes/find-recipe';
import {
  computeMissing,
  formatQty,
  normalizeIngredientName,
  scaleServings,
} from '@/lib/recipes/recipe-math';
import { cardShadow, colors } from '@/lib/theme';
import { useCartStore } from '@/store/cartStore';
import { useChefChatStore, type ChefChatMessage } from '@/store/chefChatStore';
import { useCookbookStore } from '@/store/cookbookStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { usePantryStore } from '@/store/pantryStore';
import { useRecipeStore } from '@/store/recipeStore';
import { showToast } from '@/store/toastStore';
import type { Recipe } from '@/types/recipe';

const EMPTY_MESSAGES: ChefChatMessage[] = [];

/** Hero geri butonu — referans: bg rgba(255,255,255,.9), 0 4px 12px -4px rgba(0,0,0,.25). */
const BACK_BUTTON_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.9)',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 6,
  elevation: 5,
} as const;

/** Yuvarlak aksiyon butonu dairesi — referans: 1.5px rgba(31,74,61,.25) çerçeve. */
const ACTION_CIRCLE_STYLE = {
  borderWidth: 1.5,
  borderColor: 'rgba(31,74,61,0.25)',
} as const;

/** Defterler butonunun kayıtlı hali — forest çerçeve + soluk yeşil zemin. */
const ACTION_CIRCLE_SAVED_STYLE = {
  borderWidth: 1.5,
  borderColor: colors.forest,
  backgroundColor: '#EFF3EC',
} as const;

/** Input barı — referans: 0 8px 22px -10px rgba(31,74,61,.4) + 1px rgba(31,74,61,.08) çerçeve. */
const INPUT_BAR_STYLE = {
  borderWidth: 1,
  borderColor: 'rgba(31,74,61,0.08)',
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.4,
  shadowRadius: 11,
  elevation: 6,
} as const;

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Hem üretilmiş hem içe aktarılmış tariflerde arar (defterden açılanlar dahil).
  const recipe = useRecipeById(id);

  if (!recipe) {
    return (
      <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
        <View className="px-5 pt-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri git"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-white active:scale-95"
            style={cardShadow}>
            <Ionicons name="chevron-back" size={22} color={colors.forest} />
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <Card className="w-full items-center p-8">
            <Text className="text-5xl">🔍</Text>
            <Text className="mt-4 text-center font-serif text-[21px] text-ink">
              Tarif bulunamadı
            </Text>
            <Text className="mt-2 text-center font-sans text-[13px] text-muted">
              Bu tarif artık mevcut değil ya da kaldırılmış olabilir.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri dön"
              onPress={() => router.back()}
              className="mt-5 flex-row items-center rounded-2xl bg-forest px-5 py-3 active:scale-95">
              <Ionicons name="chevron-back" size={18} color="white" />
              <Text className="ml-2 font-sans-medium text-[13px] text-white">Geri dön</Text>
            </Pressable>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return <RecipeDetailContent recipe={recipe} />;
}

/**
 * Ayrı bileşen — hook kuralları: dış bileşen tarif bulunamayınca erken
 * return yapıyor, hook'lar burada koşulsuz çağrılabilsin diye.
 */
function RecipeDetailContent({ recipe }: { recipe: Recipe }) {
  const inventoryItems = useInventoryStore((state) => state.items);
  const pantryItems = usePantryStore((state) => state.items);
  const selectedServings = useRecipeStore((state) => state.selectedServings[recipe.id]);
  const setSelectedServings = useRecipeStore((state) => state.setSelectedServings);
  const hasRecipe = useCartStore((state) => state.hasRecipe);
  const syncRecipeMissing = useCartStore((state) => state.syncRecipeMissing);
  const messages = useChefChatStore((state) => state.chats[recipe.id]) ?? EMPTY_MESSAGES;
  const addMessage = useChefChatStore((state) => state.addMessage);
  const savedRecipeIds = useCookbookStore((state) => state.savedRecipeIds);
  const cookbooks = useCookbookStore((state) => state.cookbooks);

  const [draft, setDraft] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [cookbookSheetVisible, setCookbookSheetVisible] = useState(false);
  const [planSheetVisible, setPlanSheetVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  /** Sadece sohbete mesaj eklendiğinde en alta kaydır (görsel yüklenince değil). */
  const shouldScrollToEndRef = useRef(false);

  const servings = selectedServings ?? recipe.servings;

  /** CANLI eksikler — modelin in_inventory bayrağına değil, güncel envanter+kilere göre. */
  const missingIngredients = useMemo(
    () => computeMissing(recipe, inventoryItems, pantryItems),
    [recipe, inventoryItems, pantryItems]
  );
  const missingNames = useMemo(
    () => new Set(missingIngredients.map((ingredient) => normalizeIngredientName(ingredient.name))),
    [missingIngredients]
  );

  const scaled = useMemo(() => scaleServings(recipe, servings), [recipe, servings]);

  const handleServingsChange = (next: number) => {
    const target = Math.max(1, next);
    setSelectedServings(recipe.id, target);
    // Kişi ↔ sepet senkronu (spec §5, kullanıcı kararı): tarif sepetteyse
    // eksik katkısı yeni kişi sayısına göre yeniden yazılır. Sepete EKLEME
    // butonu bu ekranda yok — ekleme tarif listesindeki rozetten yapılır.
    if (hasRecipe(recipe.name)) {
      syncRecipeMissing(
        recipe.name,
        buildCartMissingInput(recipe, target, inventoryItems, pantryItems)
      );
    }
  };

  /** Defterler butonu dolu durumu: kayıtlıda VEYA herhangi bir defterde. */
  const isSaved =
    savedRecipeIds.includes(recipe.id) ||
    cookbooks.some((cookbook) => cookbook.recipeIds.includes(recipe.id));

  /**
   * Market butonu: canlı eksikleri sepete yazar. Eksik yoksa ("hemen
   * yapabilirsin") buton disabled/sönük olduğu için hiç çağrılmaz.
   */
  const hasMissing = missingIngredients.length > 0;
  const handleMarketPress = () => {
    if (!hasMissing) return;
    syncRecipeMissing(
      recipe.name,
      buildCartMissingInput(recipe, servings, inventoryItems, pantryItems)
    );
    showToast('Eksik malzemeler markete eklendi');
  };

  const canSend = draft.trim().length > 0 && !isAsking;

  /** `text` verilirse (örnek soru chip'i) input taslağı yerine o metin gönderilir. */
  const handleSend = async (text?: string) => {
    const message = (text ?? draft).trim();
    if (!message || isAsking) return;
    const history = messages;
    addMessage(recipe.id, { role: 'user', content: message, createdAt: Date.now() });
    if (text === undefined) setDraft('');
    setIsAsking(true);
    shouldScrollToEndRef.current = true;
    try {
      const reply = await askChef(recipe, history, message);
      shouldScrollToEndRef.current = true;
      addMessage(recipe.id, { role: 'assistant', content: reply, createdAt: Date.now() });
    } catch {
      shouldScrollToEndRef.current = true;
      addMessage(recipe.id, {
        role: 'assistant',
        content: 'Şu an yanıt veremedim — bir dakika sonra tekrar sorar mısın?',
        createdAt: Date.now(),
      });
    } finally {
      setIsAsking(false);
    }
  };

  // Besin değerleri kişi sayısıyla ÖLÇEKLİ gösterilir (malzemelerle aynı çarpan).
  const macroPills = [
    { label: `Protein ${scaled.macros.protein}g`, dot: colors.macroProtein },
    { label: `Karb ${scaled.macros.karb}g`, dot: colors.macroKarb },
    { label: `Yağ ${scaled.macros.yag}g`, dot: colors.macroYag },
  ];

  /** Bilgi satırı parçaları — minimal muted metin, `·` ayraçlı (referans SCREEN 3). */
  const infoParts = [`${scaled.kcal} kcal`, `${recipe.time_min} dk`, recipe.difficulty];

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (shouldScrollToEndRef.current) {
              shouldScrollToEndRef.current = false;
              scrollRef.current?.scrollToEnd({ animated: true });
            }
          }}>
          {/* Hero görsel + üstüne bindirilmiş geri butonu ve canlı eksik rozeti */}
          <View>
            <RecipeHeroImage recipe={recipe} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri git"
              onPress={() => router.back()}
              className="absolute left-4 top-3 h-10 w-10 items-center justify-center rounded-full active:scale-95"
              style={BACK_BUTTON_STYLE}>
              <Ionicons name="chevron-back" size={20} color={colors.forest} />
            </Pressable>
            {missingIngredients.length > 0 && (
              <View className="absolute right-4 top-4">
                <MissingBadge variant="hero" count={missingIngredients.length} />
              </View>
            )}
          </View>

          {/* Krem panel: üst radius 26, görselin üstüne -22 biner, padding 22px 20px 0 */}
          <View className="-mt-[22px] rounded-t-[26px] bg-cream px-5 pt-[22px]">
            <Text className="mb-3 font-serif text-[30px] leading-[33px] text-forest">
              {recipe.name}
            </Text>

            {/* Bilgi satırı — minimal: "{kcal} kcal · {dk} dk · {zorluk}" */}
            <View className="mb-[18px] flex-row items-center gap-2">
              {infoParts.map((part, index) => (
                <View key={part} className="flex-row items-center gap-2">
                  {index > 0 && (
                    <Text className="font-sans-medium text-[12.5px] text-muted opacity-50">·</Text>
                  )}
                  <Text className="font-sans-medium text-[12.5px] text-muted">{part}</Text>
                </View>
              ))}
            </View>

            {/* 4 yuvarlak aksiyon butonu: Defterler · Plan · Market · Paylaş */}
            <View className="mb-6 flex-row justify-between">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tarifi deftere ekle"
                onPress={() => setCookbookSheetVisible(true)}
                className="w-[70px] items-center active:scale-95">
                <View
                  className="h-[52px] w-[52px] items-center justify-center rounded-full"
                  style={isSaved ? ACTION_CIRCLE_SAVED_STYLE : ACTION_CIRCLE_STYLE}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={21}
                    color={colors.forest}
                  />
                </View>
                <Text className="mt-[7px] font-sans-semibold text-[11px] text-body">
                  Defterler
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tarifi haftalık plana ekle"
                onPress={() => setPlanSheetVisible(true)}
                className="w-[70px] items-center active:scale-95">
                <View
                  className="h-[52px] w-[52px] items-center justify-center rounded-full"
                  style={ACTION_CIRCLE_STYLE}>
                  <Ionicons name="calendar-outline" size={21} color={colors.forest} />
                </View>
                <Text className="mt-[7px] font-sans-semibold text-[11px] text-body">Plan</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  hasMissing ? 'Eksik malzemeleri markete ekle' : 'Eksik malzeme yok'
                }
                accessibilityState={{ disabled: !hasMissing }}
                disabled={!hasMissing}
                onPress={handleMarketPress}
                className={`w-[70px] items-center ${hasMissing ? 'active:scale-95' : 'opacity-35'}`}>
                <View
                  className="h-[52px] w-[52px] items-center justify-center rounded-full"
                  style={ACTION_CIRCLE_STYLE}>
                  <Ionicons name="cart-outline" size={21} color={colors.forest} />
                </View>
                <Text className="mt-[7px] font-sans-semibold text-[11px] text-body">Market</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tarifi paylaş"
                onPress={() => showToast('Paylaşım sayfası açılıyor…')}
                className="w-[70px] items-center active:scale-95">
                <View
                  className="h-[52px] w-[52px] items-center justify-center rounded-full"
                  style={ACTION_CIRCLE_STYLE}>
                  <Ionicons name="share-outline" size={21} color={colors.forest} />
                </View>
                <Text className="mt-[7px] font-sans-semibold text-[11px] text-body">Paylaş</Text>
              </Pressable>
            </View>

            {/* Makro pilleri: soluk yeşil zemin, renkli nokta + değer */}
            <View className="mb-[22px] flex-row gap-2">
              {macroPills.map((macro) => (
                <View
                  key={macro.label}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[14px] bg-pillbg p-[9px]">
                  <View
                    className="h-[7px] w-[7px] rounded-full"
                    style={{ backgroundColor: macro.dot }}
                  />
                  <Text className="font-sans-semibold text-[12px] text-body">{macro.label}</Text>
                </View>
              ))}
            </View>

            {/* Malzemeler + kişi sayısı stepper'ı */}
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-serif text-[19px] text-ink">Malzemeler</Text>
              <ServingsStepper servings={servings} onChange={handleServingsChange} />
            </View>
            <View className="mb-6 rounded-[20px] bg-white px-4 py-1.5" style={cardShadow}>
              {scaled.ingredients.map((ingredient, index) => (
                <IngredientRow
                  key={`${ingredient.name}-${index}`}
                  name={ingredient.name}
                  detailText={`${formatQty(ingredient.scaledQty)} ${ingredient.unit} · ${ingredient.scaledKcal} kcal`}
                  missing={missingNames.has(normalizeIngredientName(ingredient.name))}
                />
              ))}
            </View>

            {/* Hazırlanışı — numaralı adımlar */}
            <Text className="mb-3.5 font-serif text-[19px] text-ink">Hazırlanışı</Text>
            <View className="mb-[22px] gap-3.5">
              {recipe.steps.map((step, index) => (
                <View key={`${step}-${index}`} className="flex-row gap-[13px]">
                  <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-forest">
                    <Text className="font-sans-semibold text-[12px] text-white">{index + 1}</Text>
                  </View>
                  <Text className="flex-1 pt-0.5 font-sans text-[14px] leading-[21px] text-body">
                    {step}
                  </Text>
                </View>
              ))}
            </View>

            {/* Şef Tüyosu */}
            <View className="mb-[26px] rounded-[20px] bg-cheftip-bg px-[18px] py-4">
              <View className="mb-1.5 flex-row items-center gap-2">
                <Text className="text-[16px]">👨‍🍳</Text>
                <Text
                  className="font-sans-semibold text-[13px] uppercase text-cheftip-title"
                  style={{ letterSpacing: 0.5 }}>
                  Şef Tüyosu
                </Text>
              </View>
              <Text className="font-sans text-[13.5px] leading-[21px] text-cheftip-text">
                {recipe.chef_tip}
              </Text>
            </View>

            {/* Şefe Sor — mesaj geçmişi + boşken örnek soru chip'leri (giriş çubuğu altta sabit) */}
            <ChefChat messages={messages} isTyping={isAsking} onPressExample={handleSend} />
          </View>
        </ScrollView>

        {/* Sayfaya sabit beyaz pill input + ikon gönder butonu */}
        <View className="bg-cream px-4 pb-[18px] pt-3.5">
          <View
            className="flex-row items-center gap-2 rounded-[26px] bg-white py-1.5 pl-[18px] pr-1.5"
            style={INPUT_BAR_STYLE}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Şefe bir şey sor…"
              placeholderTextColor={colors.muted2}
              className="flex-1 py-1 font-sans text-[14px] text-ink"
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
              // "Şefe bir şey sor"a basınca sayfa chat'in olduğu en alta kayar;
              // focus native olarak inputta kalır (ayrı ekran/modal yok). Küçük
              // gecikme şart: focus'un kendi scroll ayarlaması animasyonlu
              // scrollToEnd'i iptal ediyor (web önizlemesinde doğrulandı);
              // native'de de klavye açılışıyla yarışmasını önler.
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
              }}
              accessibilityLabel="Şefe soru yaz"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Soruyu şefe gönder"
              disabled={!canSend}
              onPress={() => handleSend()}
              className={`h-10 w-10 items-center justify-center rounded-full bg-forest active:scale-95 ${
                canSend ? '' : 'opacity-40'
              }`}>
              <Ionicons name="send" size={18} color="white" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Alt sheet'ler: Deftere ekle + Hangi güne? */}
      <CookbookPickerSheet
        visible={cookbookSheetVisible}
        onClose={() => setCookbookSheetVisible(false)}
        recipe={recipe}
      />
      <PlanDayPickerSheet
        visible={planSheetVisible}
        onClose={() => setPlanSheetVisible(false)}
        recipe={recipe}
        servings={servings}
      />
    </SafeAreaView>
  );
}
