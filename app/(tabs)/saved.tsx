import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CookbookCard } from '@/components/cookbooks/CookbookCard';
import { CookbookDetail } from '@/components/cookbooks/CookbookDetail';
import ImportFlow from '@/components/import/ImportFlow';
import { useResolveRecipes } from '@/lib/recipes/find-recipe';
import { cardShadow, colors } from '@/lib/theme';
import { useCookbookStore } from '@/store/cookbookStore';
import type { Cookbook } from '@/types/cookbook';
import type { Recipe } from '@/types/recipe';

/** FAB gölgesi — referans 457: 0 12px 26px -8px rgba(31,74,61,.7) yaklaşımı. */
const FAB_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.5,
  shadowRadius: 13,
  elevation: 8,
} as const;

/** Sıralama modu — Sırala butonu ikisi arasında geçiş yapar. */
type SortMode = 'name' | 'count';

interface CookbookView {
  cookbook: Cookbook;
  /** Çözülmüş tarifler (bulunamayan id'ler atlanmış) — kolaj + sayaç + arama. */
  recipes: Recipe[];
}

/** Defterleri 2'li satırlara böler (grid); tek sayıda son hücre boş kalır. */
function chunkPairs(views: CookbookView[]): [CookbookView, CookbookView | undefined][] {
  const rows: [CookbookView, CookbookView | undefined][] = [];
  for (let i = 0; i < views.length; i += 2) {
    rows.push([views[i], views[i + 1]]);
  }
  return rows;
}

/**
 * Kayıtlı — Defterlerim (cookbook koleksiyonu) ekranı; birebir referans
 * design/reference/Mutfagim.dc.html SCREEN 5 (satır 392-462). İki yerel
 * görünüm: defter listesi (kolaj kapaklı 2'li grid + arama + sıralama) ve
 * defter detayı (4 sütunlu mini tarif grid'i). Sağ altta FAB import akışını
 * (ImportFlow) açar. Sekmeden ayrılınca açık defter/akış/arama sıfırlanır.
 */
export default function SavedScreen() {
  const { t } = useTranslation();
  const cookbooks = useCookbookStore((state) => state.cookbooks);

  const [openCookbookId, setOpenCookbookId] = useState<string | null>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('name');

  // Sekme değişince reset — cleanup'ta açık defter/akış kapanır, arama boşalır.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setOpenCookbookId(null);
        setImportVisible(false);
        setQuery('');
      };
    }, [])
  );

  // Tüm defterlerin tarif id'leri TEK hook çağrısıyla çözülür (defter başına
  // ayrı hook döngüde çağrılamaz), sonra id → Recipe haritasıyla dağıtılır.
  const allIds = useMemo(
    () => Array.from(new Set(cookbooks.flatMap((cookbook) => cookbook.recipeIds))),
    [cookbooks]
  );
  const allRecipes = useResolveRecipes(allIds);
  const views = useMemo<CookbookView[]>(() => {
    const byId = new Map(allRecipes.map((recipe) => [recipe.id, recipe]));
    return cookbooks.map((cookbook) => ({
      cookbook,
      recipes: cookbook.recipeIds
        .map((id) => byId.get(id))
        .filter((recipe): recipe is Recipe => recipe !== undefined),
    }));
  }, [cookbooks, allRecipes]);

  // Arama: metin defter ADINDA veya defterdeki TARİF adlarında geçiyorsa görünür.
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
  const filteredViews = useMemo(() => {
    if (!normalizedQuery) return views;
    return views.filter(
      ({ cookbook, recipes }) =>
        cookbook.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery) ||
        recipes.some((recipe) =>
          recipe.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
        )
    );
  }, [views, normalizedQuery]);

  // Sıralama: ada göre (tr) ↔ tarif sayısına göre (çoktan aza) — gerçekten sıralar.
  const sortedViews = useMemo(() => {
    return [...filteredViews].sort((a, b) =>
      sortMode === 'name'
        ? a.cookbook.name.localeCompare(b.cookbook.name, 'tr-TR')
        : b.recipes.length - a.recipes.length
    );
  }, [filteredViews, sortMode]);

  const totalRecipes = views.reduce((sum, view) => sum + view.recipes.length, 0);
  const openView = views.find((view) => view.cookbook.id === openCookbookId) ?? null;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      {openView ? (
        <CookbookDetail
          name={openView.cookbook.name}
          recipes={openView.recipes}
          onBack={() => setOpenCookbookId(null)}
          onPressRecipe={(id) => router.push(`/recipe/${id}`)}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="px-5 pt-2">
            {/* Üst blok — referans 426-435: solda eyebrow + h1, sağda Sırala. */}
            <View className="flex-row items-start justify-between">
              <View>
                <Text
                  className="font-sans text-[13px] text-muted"
                  style={{ letterSpacing: 0.3 }}>
                  {t('saved.subtitle', { recipes: totalRecipes, cookbooks: cookbooks.length })}
                </Text>
                <Text className="mt-[2px] font-serif text-[34px] text-forest">{t('saved.title')}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('saved.sortA11y')}
                onPress={() => setSortMode((mode) => (mode === 'name' ? 'count' : 'name'))}
                className="mt-2 flex-row items-center gap-[6px] rounded-[20px] border bg-white px-3 py-2 active:scale-95"
                style={{ borderColor: colors.chipBorderSm }}>
                <Ionicons name="swap-vertical" size={14} color={colors.forest} />
                {/* Etiket aktif ölçütü söyler — dokununca değişir (görsel geri bildirim). */}
                <Text className="font-sans-semibold text-[12px] text-forest">
                  {sortMode === 'name' ? t('saved.sortByName') : t('saved.sortByCount')}
                </Text>
              </Pressable>
            </View>

            {/* Arama çubuğu — referans 437-440: beyaz radius 16, search ikonu + input. */}
            <View
              className="mb-5 mt-[18px] flex-row items-center gap-[10px] rounded-[16px] bg-white px-[15px] py-3"
              style={cardShadow}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('saved.searchPlaceholder')}
                placeholderTextColor="#A2ABA4"
                className="flex-1 p-0 font-sans text-[14px] text-ink"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            {/* Defter grid'i — referans 442: 2 sütun, gap 16. */}
            {sortedViews.length === 0 ? (
              <Text className="mt-6 text-center font-sans text-[13px] text-muted">
                {t('saved.searchEmpty')}
              </Text>
            ) : (
              <View className="gap-4">
                {chunkPairs(sortedViews).map(([left, right]) => (
                  <View key={left.cookbook.id} className="flex-row gap-4">
                    <View className="flex-1">
                      <CookbookCard
                        cookbook={left.cookbook}
                        recipes={left.recipes}
                        onPress={() => setOpenCookbookId(left.cookbook.id)}
                      />
                    </View>
                    {right ? (
                      <View className="flex-1">
                        <CookbookCard
                          cookbook={right.cookbook}
                          recipes={right.recipes}
                          onPress={() => setOpenCookbookId(right.cookbook.id)}
                        />
                      </View>
                    ) : (
                      <View className="flex-1" />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* FAB — referans 456-459: 58×58 yuvarlak forest, beyaz plus; import akışını açar. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('saved.addRecipeA11y')}
        onPress={() => setImportVisible(true)}
        className="absolute bottom-6 right-5 h-[58px] w-[58px] items-center justify-center rounded-full bg-forest active:scale-95"
        style={FAB_SHADOW}>
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>

      {/* "+" Tarif Ekle akışı — host burada, içerik ImportFlow'un sorumluluğu. */}
      <ImportFlow visible={importVisible} onClose={() => setImportVisible(false)} />
    </SafeAreaView>
  );
}
