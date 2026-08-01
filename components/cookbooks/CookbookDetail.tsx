import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';

import RecipeCard from '@/components/recipes/RecipeCard';
import { EmptyState } from '@/components/ui';
import { colors } from '@/lib/theme';
import type { Recipe } from '@/types/recipe';

/** Geri butonu gölgesi — referans 399: 0 2px 8px -3px rgba(31,74,61,.25). */
const BACK_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 3,
} as const;

/** Grid sütun sayısı — kullanıcı kararı (1 Ağu): 4'lü mini grid çok küçük
 * kalıyordu; Tarifler sekmesindeki büyük kartlarla (RecipeCard) 2 sütun. */
const COLUMNS = 2;

/** Tarifleri 2'li satırlara böler; eksik hücreler null ile doldurulur (boş flex-1). */
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
 * forest), tarifler 2 sütunlu grid'de Tarifler sekmesiyle AYNI büyük
 * kartlarla (RecipeCard — kullanıcı kararı, 1 Ağu). Defter boşsa
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
          <View className="mt-4 gap-[14px]">
            {chunkRows(recipes).map((row, rowIndex) => (
              <View key={rowIndex} className="flex-row gap-[14px]">
                {row.map((recipe, cellIndex) =>
                  recipe ? (
                    <View key={recipe.id} className="flex-1">
                      <RecipeCard recipe={recipe} onPress={onPressRecipe} />
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

/** Yönlendirmeli boş durum — kullanıcıya tarifin nasıl ekleneceğini söyler;
 * CTA Tarifler sekmesine götürür (kaydetme oradaki Defterler butonuyla). */
function EmptyCookbook() {
  const { t } = useTranslation();
  return (
    <View className="pt-8">
      <EmptyState
        icon={<Ionicons name="book-outline" size={30} color={colors.muted} />}
        title={t('cookbooks.emptyTitle')}
        body={t('cookbooks.emptyBody')}
        ctaLabel={t('cookbooks.emptyCta')}
        onPressCta={() => router.push('/recipes')}
      />
    </View>
  );
}
