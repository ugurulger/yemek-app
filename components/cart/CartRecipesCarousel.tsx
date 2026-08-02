import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';

import { PhotoPlaceholder } from '@/components/ui';
import { cardShadow, colors, photoTones } from '@/lib/theme';
import { useLocalizedRecipe } from '@/src/i18n/recipeI18n';
import { useRecipeImage } from '@/services/images/useRecipeImage';
import { useCookbookStore } from '@/store/cookbookStore';
import { useRecipeStore } from '@/store/recipeStore';
import type { Recipe } from '@/types/recipe';

export interface CartRecipesCarouselProps {
  /** Sepete katkısı olan tariflerin KANONİK adları (CartEntry.recipeName). */
  recipeNames: string[];
}

/** Kart genişliği/foto yüksekliği — referans: yatay şeritte ~2.3 kart görünür. */
const CARD_WIDTH = 148;
const CARD_IMAGE_HEIGHT = 96;

/** Tarif adına deterministik placeholder ton çifti (RecipeCard ile aynı kalıp). */
function tonesForRecipe(name: string): readonly [string, string] {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return photoTones[hash % photoTones.length];
}

/**
 * Sepetin üstündeki yatay "Tarifler" şeridi — referans:
 * design/reference/grocery-recipes-carousel.jpg. Sepete malzeme ekleyen her
 * tarif için görselli bir kart; "Tarife git" detay ekranını açar. Başlıktaki
 * chevron bölümü daraltır/genişletir (yalnız UI state'i, persist edilmez).
 *
 * Tarifler KANONİK adla (üretim dili — sepetteki birleştirme anahtarıyla aynı)
 * iki kaynaktan çözülür: üretilmiş (recipeStore) + içe aktarılmış
 * (cookbookStore.importedRecipes). Artık hiçbir kaynakta olmayan tarif
 * (envanter değişince yeniden üretilmiş) sessizce atlanır; hiç tarif
 * çözülemezse şerit hiç çizilmez.
 */
export function CartRecipesCarousel({ recipeNames }: CartRecipesCarouselProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const generated = useRecipeStore((state) => state.recipes);
  const imported = useCookbookStore((state) => state.importedRecipes);

  const recipes = useMemo(() => {
    const byName = new Map<string, Recipe>();
    for (const recipe of imported) byName.set(recipe.name, recipe);
    for (const recipe of generated) byName.set(recipe.name, recipe);
    return recipeNames
      .map((name) => byName.get(name))
      .filter((recipe): recipe is Recipe => recipe !== undefined);
  }, [recipeNames, generated, imported]);

  if (recipes.length === 0) {
    return null;
  }

  return (
    <View className="mb-4">
      {/* Başlık satırı — bölüm adı + daralt/genişlet chevron'u (referanstaki gibi). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(collapsed ? 'market.recipesExpandA11y' : 'market.recipesCollapseA11y')}
        onPress={() => setCollapsed((value) => !value)}
        className="mb-2.5 flex-row items-center gap-2 px-5 active:opacity-70">
        <Text className="font-sans-semibold text-[14px] text-ink">
          {t('market.recipesSection')}
        </Text>
        <View className="h-6 w-6 items-center justify-center rounded-full bg-white" style={cardShadow}>
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={13} color={colors.ink} />
        </View>
      </Pressable>

      {!collapsed ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
          {recipes.map((recipe) => (
            <RecipeStripCard key={recipe.id} recipe={recipe} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

/** Şeritteki tek kart: foto + yerelleştirilmiş ad + "Tarife git" linki. */
function RecipeStripCard({ recipe }: { recipe: Recipe }) {
  const { t } = useTranslation();
  // Görsel cache anahtarı ORİJİNAL tarif adıdır (recipeI18n kuralı) — görsel
  // orijinal kayıttan, gösterim adı yerelleştirilmiş kopyadan gelir.
  const { uri: imageUri } = useRecipeImage(recipe, 'thumbnail');
  const localized = useLocalizedRecipe(recipe);
  const [tone1, tone2] = tonesForRecipe(recipe.name);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('market.viewRecipeA11y', { name: localized.name })}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      className="overflow-hidden rounded-2xl bg-white active:scale-[0.97]"
      style={[cardShadow, { width: CARD_WIDTH }]}>
      <View style={{ height: CARD_IMAGE_HEIGHT }}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            className="h-full w-full"
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <PhotoPlaceholder
            tone1={tone1}
            tone2={tone2}
            label={t('recipes.photoA11y', { name: localized.name })}
            className="h-full w-full"
          />
        )}
      </View>
      <View className="px-2.5 pb-2.5 pt-2">
        <Text className="font-sans-semibold text-[12.5px] text-ink" numberOfLines={1}>
          {localized.name}
        </Text>
        <View className="mt-1 flex-row items-center gap-0.5">
          <Text className="font-sans-medium text-[11px] text-muted">{t('market.viewRecipe')}</Text>
          <Ionicons name="chevron-forward" size={11} color={colors.muted} />
        </View>
      </View>
    </Pressable>
  );
}
