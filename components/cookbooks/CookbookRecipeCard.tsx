import { Image, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PhotoPlaceholder } from '@/components/ui';
import { computeMissing } from '@/lib/recipes/recipe-math';
import { colors, photoTones } from '@/lib/theme';
import { difficultyKey, nutritionTagKey } from '@/src/i18n/labels';
import { useRecipeImage } from '@/services/images/useRecipeImage';
import { useInventoryStore } from '@/store/inventoryStore';
import { usePantryStore } from '@/store/pantryStore';
import type { Recipe } from '@/types/recipe';

/** Mini görsel kutusu gölgesi — referans 407: 0 3px 10px -5px rgba(31,74,61,.28). */
const MINI_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.28,
  shadowRadius: 5,
  elevation: 3,
} as const;

/**
 * Placeholder ton çifti — tarif ADINA göre deterministik seçilir
 * (components/recipes/RecipeCard.tsx `tonesForRecipe` ile aynı yaklaşım;
 * aynı tarif her yerde aynı tonda görünsün).
 */
function tonesForRecipe(name: string): readonly [string, string] {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return photoTones[hash % photoTones.length];
}

interface CookbookRecipeCardProps {
  recipe: Recipe;
  onPress: (id: string) => void;
}

/**
 * Defter detayındaki 4 sütunluk grid'in mini tarif kartı — birebir referans
 * (SCREEN 5, satır 406-418): 86px görsel kutusu (radius 14), sağ üstte beyaz
 * kcal pili, canlı eksik varsa sol üstte amber mini rozet, alt kenarda koyu
 * yarı saydam "{time}dk · {diff}" şeridi (RecipeCard'daki photoStripBg
 * yaklaşımı); kutunun altında tarif adı (500 11 ink, 2 satır) +
 * "{nutrition_tag} · {kcal} kcal/kişi" (600 8 muted2).
 * Eksik sayısı CANLI hesaplanır (computeMissing) — üretim anındaki
 * `missing_count` bayat olabilir.
 */
export function CookbookRecipeCard({ recipe, onPress }: CookbookRecipeCardProps) {
  const { t } = useTranslation();
  const { uri: imageUri } = useRecipeImage(recipe, 'thumbnail');
  const inventoryItems = useInventoryStore((state) => state.items);
  const pantryItems = usePantryStore((state) => state.items);

  const liveMissingCount = computeMissing(recipe, inventoryItems, pantryItems).length;
  const [tone1, tone2] = tonesForRecipe(recipe.name);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('recipes.openRecipeA11y', { name: recipe.name })}
      onPress={() => onPress(recipe.id)}
      className="active:scale-95">
      <View className="overflow-hidden rounded-[14px]" style={[{ height: 86 }, MINI_SHADOW]}>
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
            label={recipe.emoji}
            className="h-full w-full"
          />
        )}

        {/* Sağ üst: beyaz %92 opak kcal pili — 600 7.5px #3A463F (referans 408). */}
        <View
          className="absolute right-[5px] top-[5px] rounded-[20px] px-[5px] py-[2px]"
          style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}>
          <Text className="font-sans-semibold text-[7.5px] text-body">{recipe.kcal}</Text>
        </View>

        {/* Sol üst: CANLI eksik varsa amber mini rozet (referans 410). */}
        {liveMissingCount > 0 && (
          <View className="absolute left-[5px] top-[5px] rounded-[20px] bg-amber px-[5px] py-[2px]">
            <Text className="font-sans-semibold text-[7.5px] text-white">{liveMissingCount}</Text>
          </View>
        )}

        {/* Alt kenar: koyu yarı saydam şerit (referanstaki gradient yerine
            photoStripBg — RecipeCard'daki kabul edilen yaklaşım). */}
        <View
          className="absolute inset-x-0 bottom-0 px-[6px] py-[5px]"
          style={{ backgroundColor: colors.photoStripBg }}>
          <Text className="font-sans-semibold text-[7.5px] text-white" numberOfLines={1}>
            {t('recipeDetail.infoMinutesShort', { minutes: recipe.time_min })} ·{' '}
            {t(difficultyKey(recipe.difficulty))}
          </Text>
        </View>
      </View>

      {/* Kutu altı: tarif adı (2 satıra kadar) + beslenme etiketi satırı. */}
      <Text
        className="mx-[1px] mt-[5px] font-sans-medium text-[11px] leading-[13px] text-ink"
        numberOfLines={2}>
        {recipe.name}
      </Text>
      <Text className="mx-[1px] mt-[2px] font-sans-semibold text-[8px] text-muted2" numberOfLines={1}>
        {t(nutritionTagKey(recipe.nutrition_tag))} · {t('recipes.kcalPerPerson', { kcal: recipe.kcal })}
      </Text>
    </Pressable>
  );
}
