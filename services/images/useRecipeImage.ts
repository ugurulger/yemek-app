import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { Recipe } from '@/types/recipe';
import {
  enqueueRecipeImage,
  getCachedRecipeImage,
  type RecipeImageUris,
} from './recipe-image';

export interface RecipeImageState {
  /** Görselin dosya URI'si; henüz üretilmediyse/başarısızsa null. */
  uri: string | null;
  /** Üretim kuyrukta/sürüyor — placeholder bu sırada pulse animasyonu oynatır. */
  isGenerating: boolean;
}

/**
 * Tarif görselinin URI'sini döndürür; henüz üretilmediyse `uri: null`
 * (çağıran taraf emoji'li placeholder gösterir) ve üretimi lazy kuyruğa
 * ekler. Cache'te varsa API'ye hiç gidilmez. Kart listede küçük kopyayı
 * (`thumbnail`), detay ekranı orijinali (`original`) ister.
 */
export function useRecipeImage(
  recipe: Recipe,
  variant: 'thumbnail' | 'original'
): RecipeImageState {
  const [uris, setUris] = useState<RecipeImageUris | null>(() => {
    try {
      return getCachedRecipeImage(recipe.name);
    } catch {
      // Dosya sistemi bu platformda kullanılamıyorsa (örn. web) placeholder'da kal.
      return null;
    }
  });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (uris) {
      return;
    }
    // Web hedef platform değil; tarayıcı önizlemesinde kart mount'larının
    // maliyetli görsel üretim çağrıları tetiklemesini engelle.
    if (Platform.OS === 'web') {
      return;
    }
    let active = true;
    setIsGenerating(true);
    const ingredientsSummary = recipe.ingredients
      .slice(0, 5)
      .map((ingredient) => ingredient.name)
      .join(', ');
    enqueueRecipeImage(recipe.name, ingredientsSummary, recipe.image_prompt_en)
      .then((result) => {
        if (active) {
          setUris(result);
          setIsGenerating(false);
        }
      })
      .catch(() => {
        // Hatanın tam mesajı enqueueRecipeImage içinde loglanır; burada
        // yalnızca pulse durdurulur, emoji'li placeholder gösterilmeye
        // devam eder. Kart yeniden mount olduğunda tekrar denenir.
        if (active) {
          setIsGenerating(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tarif adı cache anahtarıdır
  }, [recipe.name]);

  if (!uris) {
    return { uri: null, isGenerating };
  }
  return {
    uri: variant === 'thumbnail' ? uris.thumbnailUri : uris.originalUri,
    isGenerating: false,
  };
}
