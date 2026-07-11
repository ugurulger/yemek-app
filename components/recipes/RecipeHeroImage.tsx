import React from 'react';
import { Image } from 'react-native';

import { PhotoPlaceholder } from '@/components/ui';
import { photoTones } from '@/lib/theme';
import { useRecipeImage } from '@/services/images/useRecipeImage';
import type { Recipe } from '@/types/recipe';

/** Referans SCREEN 3: hero SABİT 270px yüksekliktir (4:3 oran DEĞİL). */
const HERO_HEIGHT = 270;

/**
 * Placeholder ton çifti — referanstaki `photo:[t1,t2]` çiftleri (lib/theme.ts
 * `photoTones`) tarif adına göre deterministik seçilir ki aynı tarif hep
 * aynı tonda görünsün.
 */
function tonesForRecipe(name: string): readonly [string, string] {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return photoTones[hash % photoTones.length];
}

/**
 * Tarif detayının üst görseli (referans SCREEN 3): AI görseli hazırsa tam
 * genişlik, 270px sabit yükseklikte FULL-BLEED banner (köşe yuvarlatma YOK —
 * altındaki krem panel üstüne biner); üretilene kadar AYNI boyutta diagonal
 * PhotoPlaceholder ("{ad} fotoğrafı" etiketiyle) gösterilir — layout kaymaz.
 * Ayrı bileşen olmasının nedeni hook kuralları — detay ekranı tarif
 * bulunamadığında erken return yapıyor, hook koşulsuz çağrılamıyor.
 */
export default function RecipeHeroImage({ recipe }: { recipe: Recipe }) {
  const { uri: imageUri } = useRecipeImage(recipe, 'original');

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        className="w-full bg-sand"
        style={{ height: HERO_HEIGHT }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

  const [tone1, tone2] = tonesForRecipe(recipe.name);
  return (
    <PhotoPlaceholder
      tone1={tone1}
      tone2={tone2}
      label={`${recipe.name.toLocaleLowerCase('tr-TR')} fotoğrafı`}
      className="w-full"
      style={{ height: HERO_HEIGHT }}
    />
  );
}
