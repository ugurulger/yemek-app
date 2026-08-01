import React, { useEffect, useState } from 'react';
import { Image, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PhotoPlaceholder } from '@/components/ui';
import { photoTones } from '@/lib/theme';
import { useRecipeImage } from '@/services/images/useRecipeImage';
import type { Recipe } from '@/types/recipe';

/**
 * P8-6: Hero yüksekliği artık görselin GERÇEK oranından hesaplanır.
 * Eski sabit 270px + cover, kare üretilen AI görsellerinde ~%30'luk dikey
 * kırpma yaratıyordu ("2x zoom" görünümü). Yeni mantık: genişliğe sığdır,
 * doğal yüksekliği [MIN, MAX] aralığına kıstır — aralık içindeyse görsel
 * HİÇ kırpılmaz, aralık dışında minimum kırpma olur. Kartlardaki küçük
 * görseller (132px, cover) ile aynı "genişliğe sığdır" kadraj mantığı.
 */
const HERO_MIN_HEIGHT = 240;
const HERO_MAX_HEIGHT = 360;
const HERO_FALLBACK_HEIGHT = 270;

function tonesForRecipe(name: string): readonly [string, string] {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return photoTones[hash % photoTones.length];
}

/**
 * Tarif detayının üst görseli (referans SCREEN 3): AI görseli hazırsa tam
 * genişlik, orana göre uyarlanan yükseklikte FULL-BLEED banner (köşe
 * yuvarlatma YOK — altındaki krem panel üstüne biner); üretilene kadar aynı
 * boyutta diagonal PhotoPlaceholder gösterilir — layout kaymaz. Ayrı bileşen
 * olmasının nedeni hook kuralları — detay ekranı tarif bulunamadığında erken
 * return yapıyor, hook koşulsuz çağrılamıyor.
 */
export default function RecipeHeroImage({ recipe }: { recipe: Recipe }) {
  const { t } = useTranslation();
  const { uri: imageUri } = useRecipeImage(recipe, 'original');
  const { width: screenWidth } = useWindowDimensions();
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  // Görselin doğal oranı asenkron okunur; okunana (veya hata olursa) kadar
  // fallback yükseklik kullanılır — placeholder ile aynı olduğundan büyük
  // bir sıçrama yaşanmaz.
  useEffect(() => {
    if (!imageUri) {
      setNaturalRatio(null);
      return;
    }
    let cancelled = false;
    Image.getSize(
      imageUri,
      (width, height) => {
        if (!cancelled && width > 0) {
          setNaturalRatio(height / width);
        }
      },
      () => {
        /* oran okunamadı — fallback yükseklikte cover ile devam */
      }
    );
    return () => {
      cancelled = true;
    };
  }, [imageUri]);

  const heroHeight =
    naturalRatio === null
      ? HERO_FALLBACK_HEIGHT
      : Math.min(HERO_MAX_HEIGHT, Math.max(HERO_MIN_HEIGHT, screenWidth * naturalRatio));

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        className="w-full bg-sand"
        style={{ height: heroHeight }}
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
      label={t('recipes.photoA11y', { name: recipe.name })}
      className="w-full"
      style={{ height: HERO_FALLBACK_HEIGHT }}
    />
  );
}
