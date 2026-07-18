import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/lib/theme';
import type { Recipe } from '@/types/recipe';
import { CookbookRecipeCard } from './CookbookRecipeCard';

/** Geri butonu gölgesi — referans 399: 0 2px 8px -3px rgba(31,74,61,.25). */
const BACK_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 3,
} as const;

/** Grid sütun sayısı — birebir referans (404): repeat(4,1fr). */
const COLUMNS = 4;

/** Tarifleri 4'lü satırlara böler; eksik hücreler null ile doldurulur (boş flex-1). */
function chunkRows(recipes: Recipe[]): (Recipe | null)[][] {
  const rows: (Recipe | null)[][] = [];
  for (let i = 0; i < recipes.length; i += COLUMNS) {
    const row: (Recipe | null)[] = recipes.slice(i, i + COLUMNS);
    while (row.length < COLUMNS) row.push(null);
    rows.push(row);
  }
  return rows;
}

interface CookbookDetailProps {
  name: string;
  /** Defterin çözülmüş tarifleri (bulunamayan id'ler atlanmış). */
  recipes: Recipe[];
  onBack: () => void;
  onPressRecipe: (id: string) => void;
}

/**
 * Defter detayı görünümü — birebir referans (SCREEN 5, satır 396-421):
 * üstte 40×40 beyaz daire geri butonu, altında defter adı h1 (serif 32
 * forest), tarifler 4 sütunlu grid'de (gap 9) mini kartlarla. Defter boşsa
 * yönlendirmeli boş durum gösterilir (tasarım kuralı: asla sadece "boş" yazma).
 */
export function CookbookDetail({ name, recipes, onBack, onPressRecipe }: CookbookDetailProps) {
  const { t } = useTranslation();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="px-5 pt-2">
        {/* Geri butonu — referans 398-402 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cookbooks.backToListA11y')}
          onPress={onBack}
          className="h-10 w-10 items-center justify-center rounded-full bg-white active:scale-95"
          style={BACK_SHADOW}>
          <Ionicons name="chevron-back" size={20} color={colors.forest} />
        </Pressable>

        {/* Defter adı — referans 403: 500 32px Newsreader forest */}
        <Text className="mb-[2px] mt-2 font-serif text-[32px] text-forest">{name}</Text>

        {recipes.length === 0 ? (
          <EmptyCookbook />
        ) : (
          <View className="mt-4 gap-[9px]">
            {chunkRows(recipes).map((row, rowIndex) => (
              <View key={rowIndex} className="flex-row gap-[9px]">
                {row.map((recipe, cellIndex) =>
                  recipe ? (
                    <View key={recipe.id} className="flex-1">
                      <CookbookRecipeCard recipe={recipe} onPress={onPressRecipe} />
                    </View>
                  ) : (
                    <View key={`empty-${cellIndex}`} className="flex-1" />
                  )
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/** Yönlendirmeli boş durum — kullanıcıya tarifin nasıl ekleneceğini söyler. */
function EmptyCookbook() {
  const { t } = useTranslation();
  return (
    <View className="items-center px-8 pt-16">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-white">
        <Ionicons name="book-outline" size={30} color={colors.muted} />
      </View>
      <Text className="mt-4 text-center font-sans text-[13px] leading-[19px] text-muted">
        {t('cookbooks.emptyBody')}
      </Text>
    </View>
  );
}
