import React from 'react';
import { Image, View } from 'react-native';

import RecipeImagePlaceholder from '@/components/recipes/RecipeImagePlaceholder';
import { useRecipeImage } from '@/services/images/useRecipeImage';
import type { Recipe } from '@/types/recipe';

interface RecipeHeroImageProps {
  recipe: Recipe;
}

/**
 * Tarif detayının üst görseli: AI görseli hazırsa ORİJİNAL boyutlu kopyayı
 * tam genişlikte 4:3 banner olarak gösterir; üretilene kadar AYNI oranda
 * emoji'li placeholder (yüklenirken hafif pulse) gösterilir — layout kaymaz.
 * Ayrı bileşen olmasının nedeni hook kuralları — detay ekranı tarif
 * bulunamadığında erken return yapıyor, hook koşulsuz çağrılamıyor.
 */
export default function RecipeHeroImage({ recipe }: RecipeHeroImageProps) {
  const { uri: imageUri, isGenerating } = useRecipeImage(recipe, 'original');

  return (
    <View className="w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-stone-100">
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          className="aspect-[4/3] w-full bg-stone-100"
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <RecipeImagePlaceholder
          emoji={recipe.emoji}
          boxClassName="aspect-[4/3] w-full rounded-2xl"
          emojiSize={64}
          pulsing={isGenerating}
        />
      )}
    </View>
  );
}
