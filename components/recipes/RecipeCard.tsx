import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MissingBadge, PhotoPlaceholder } from '@/components/ui';
import { buildCartMissingInput } from '@/lib/recipes/cart-helpers';
import { computeMissing } from '@/lib/recipes/recipe-math';
import { colors, photoTones } from '@/lib/theme';
import { getAppLanguage } from '@/src/i18n';
import { expandInventoryForMatching, expandPantryForMatching } from '@/src/i18n/inventoryI18n';
import { difficultyKey, nutritionTagKey } from '@/src/i18n/labels';
import { useRecipeImage } from '@/services/images/useRecipeImage';
import { useCartStore } from '@/store/cartStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { usePantryStore } from '@/store/pantryStore';
import { useRecipeStore } from '@/store/recipeStore';
import type { Recipe } from '@/types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: (id: string) => void;
}

/** Foto konteyneri SABİT yüksekliği — birebir referans: `height:132px`. */
export const CARD_IMAGE_HEIGHT = 132;

/** Foto konteyneri gölgesi — birebir referans: 0 4px 14px -6px rgba(31,74,61,.28). */
const CARD_PHOTO_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.28,
  shadowRadius: 7,
  elevation: 4,
} as const;

/**
 * Placeholder ton çifti — `lib/theme.ts` `photoTones` (referanstaki tarif
 * `photo:[t1,t2]` paleti). Tarif ADINA göre deterministik seçilir ki aynı
 * tarif hep aynı tonda görünsün (referans `mapRecipe` → `photoStyleOf(r.photo)`).
 */
function tonesForRecipe(name: string): readonly [string, string] {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return photoTones[hash % photoTones.length];
}

/**
 * Dikey tarif kartı — birebir referans (Mutfagim.dc.html SCREEN 2, tarif
 * grid'i): 132px sabit foto bloğu (radius 20, gölge), sağ üstte TEK SATIR
 * beyaz "{kcal} kcal/kişi" pili, alt kenarda koyu bilgi şeridi
 * ("{time} dk · {diff} · {tag}"), altında tarif adı (500 14.5px).
 * Eksikli tariflerde sol üstte DOKUNULABİLİR amber "N eksik" rozeti
 * (`MissingBadge variant='card'`) — basınca eksikler seçili kişi sayısına
 * ölçeklenip sepete yazılır; tarif zaten sepetteyse rozet forest dolgulu
 * "Sepette" durumuna geçer ve tekrar basınca sepetten çıkar (toggle).
 * Eksik sayısı CANLI hesaplanır (`computeMissing`) — üretim anındaki
 * `missing_count` bayat olabilir. Kart mount olduğunda referanstaki popIn
 * animasyonunu oynar (opacity 0→1 + translateY 6→0, 300ms ease, bir kez).
 */
export default function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  const { t } = useTranslation();
  // Lazy: görsel hazır değilse uri null döner (placeholder gösterilir) ve
  // üretim arka plandaki sıralı kuyruğa eklenir — bkz. services/images/
  const { uri: imageUri } = useRecipeImage(recipe, 'thumbnail');

  const inventoryItems = useInventoryStore((state) => state.items);
  const pantryItems = usePantryStore((state) => state.items);
  const selectedServings = useRecipeStore((state) => state.selectedServings);
  // KANONİK kaynak orijinal tarif (İş 3c): `recipe` prop'u yerelleştirilmiş
  // kopya olabilir (recipes.tsx → useLocalizedRecipes) — sepet anahtarı
  // (recipeName) ve eksik hesabı, detay ekranıyla AYNI orijinal kayıt
  // üzerinden yapılır ki dil değişimi rozet/sepet durumunu bozmasın.
  const originalRecipe =
    useRecipeStore((state) => state.recipes.find((entry) => entry.id === recipe.id)) ?? recipe;
  const inCart = useCartStore((state) =>
    state.entries.some((entry) => entry.recipeName === originalRecipe.name)
  );
  const syncRecipeMissing = useCartStore((state) => state.syncRecipeMissing);
  const removeRecipe = useCartStore((state) => state.removeRecipe);

  // İki dilli ad varyantlarıyla eşleştirme (bkz. src/i18n/inventoryI18n.ts).
  const liveMissingCount = computeMissing(
    originalRecipe,
    expandInventoryForMatching(inventoryItems),
    expandPantryForMatching(pantryItems)
  ).length;
  const [tone1, tone2] = tonesForRecipe(recipe.name);

  // popIn (referans: animation:popIn .3s ease both) — mount'ta bir kez.
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(pop, {
      toValue: 1,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  }, [pop]);

  function handleBadgePress() {
    if (inCart) {
      removeRecipe(originalRecipe.name);
      return;
    }
    const targetServings = selectedServings[recipe.id] ?? recipe.servings;
    // Envanter/kiler adları İKİ DİLLİ varyantlarıyla genişletilir (rozetteki
    // computeMissing ile aynı girdi — rozet 3 eksik derken sepete 1 ürün
    // yazma tutarsızlığı olmasın). Karşı dil adları, prop olarak gelen
    // yerelleştirilmiş kopyadan index hizalı geçirilir (İş 3c).
    syncRecipeMissing(
      originalRecipe.name,
      buildCartMissingInput(
        originalRecipe,
        targetServings,
        expandInventoryForMatching(inventoryItems),
        expandPantryForMatching(pantryItems),
        recipe !== originalRecipe
          ? {
              language: getAppLanguage(),
              ingredientNames: recipe.ingredients.map((ingredient) => ingredient.name),
            }
          : undefined
      )
    );
  }

  // NOT: eksik/sepet rozeti kart Pressable'ının İÇİNE konulmaz — iç içe iki
  // "button" web'de geçersiz HTML olur (SSR parser'ı yapıyı bozar) ve native
  // tarafta da iç içe dokunma alanı karışıklığı yaratır. Rozet, kartın
  // ÜZERİNE absolute konumlanan bir KARDEŞ Pressable'dır.
  return (
    <Animated.View
      className="w-full"
      style={{
        opacity: pop,
        transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('recipes.openRecipeA11y', { name: recipe.name })}
        onPress={() => onPress(recipe.id)}
        className="active:scale-95">
        <View
          className="w-full overflow-hidden rounded-[20px] bg-white"
          style={[CARD_PHOTO_SHADOW, { height: CARD_IMAGE_HEIGHT }]}>
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
              label={t('recipes.photoA11y', { name: recipe.name })}
              className="h-full w-full"
            />
          )}

          {/* Sağ üst: TEK SATIR beyaz kcal pili — 600 9.5px #3A463F,
              bg rgba(255,255,255,.92), padding 3×8, radius 20. */}
          <View
            className="absolute right-2 top-2 rounded-[20px] px-2 py-[3px]"
            style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}>
            <Text className="font-sans-semibold text-[9.5px] text-body">
              {t('recipes.kcalPerPerson', { kcal: recipe.kcal })}
            </Text>
          </View>

          {/* İş 1: fine dining rozeti — kcal pilinin altında, aynı pil
              tipografisiyle koyu forest dolgu (kcal piliyle karışmasın). */}
          {recipe.category === 'fine-dining' && (
            <View className="absolute right-2 top-8 rounded-[20px] bg-forest px-2 py-[3px]">
              <Text className="font-sans-semibold text-[9.5px] text-white">
                ✦ {t('recipes.fineDiningBadge')}
              </Text>
            </View>
          )}

          {/* Alt kenar: koyu bilgi şeridi — padding 7×9, 600 8.5px beyaz,
              ayraç noktaları rgba(255,255,255,.55), gap 4. (Referanstaki
              gradient yerine düz photoStripBg — kabul edilen yaklaşım.) */}
          <View
            className="absolute inset-x-0 bottom-0 flex-row items-center gap-1 px-[9px] py-[7px]"
            style={{ backgroundColor: colors.photoStripBg }}>
            <Text className="font-sans-semibold text-[8.5px] text-white" numberOfLines={1}>
              {t('recipeDetail.infoMinutes', { minutes: recipe.time_min })}
            </Text>
            <Text className="font-sans-semibold text-[8.5px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              ·
            </Text>
            <Text className="font-sans-semibold text-[8.5px] text-white" numberOfLines={1}>
              {t(difficultyKey(recipe.difficulty))}
            </Text>
            <Text className="font-sans-semibold text-[8.5px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              ·
            </Text>
            <Text
              className="flex-shrink font-sans-semibold text-[8.5px] text-white"
              numberOfLines={1}>
              {t(nutritionTagKey(recipe.nutrition_tag))}
            </Text>
          </View>
        </View>

        {/* Kart altı (görsel dışı): tarif adı — 500 14.5px #23302B, margin 8px üst 2px yan. */}
        <Text className="mx-0.5 mt-2 font-sans-medium text-[14.5px] text-ink" numberOfLines={1}>
          {recipe.name}
        </Text>
      </Pressable>

      {/* Sol üst: dokunulabilir eksik/sepet rozeti (alışveriş bölümü kartları). */}
      {(liveMissingCount > 0 || inCart) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            inCart
              ? t('recipes.removeFromCartA11y', { name: recipe.name })
              : t('recipes.addMissingToCartA11y', { name: recipe.name, count: liveMissingCount })
          }
          onPress={handleBadgePress}
          hitSlop={6}
          className="absolute left-2 top-2 active:scale-90">
          {inCart ? (
            // "Sepette" durumu — kart-rozet tipografisi (600 10px, 4×9,
            // radius 20) forest dolguyla.
            <View className="rounded-[20px] bg-forest px-[9px] py-1">
              <Text className="font-sans-semibold text-[10px] text-white">{t('recipes.inCartBadge')}</Text>
            </View>
          ) : (
            <MissingBadge count={liveMissingCount} variant="card" />
          )}
        </Pressable>
      )}
    </Animated.View>
  );
}
