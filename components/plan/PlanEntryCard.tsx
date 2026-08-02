import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';

import { cardShadow, colors, photoTones } from '@/lib/theme';
import { getCachedRecipeImage } from '@/services/images/recipe-image';
import type { PlanEntry } from '@/store/planStore';

interface PlanEntryCardProps {
  entry: PlanEntry;
  onPress: () => void;
  onRemove: () => void;
}

/** Görsel kutusu boyutu ve zoom çarpanı — kullanıcı kararı (2 Ağu, dikey
 * doluluk işi): 48×48 kutu 2x'e (96×96) büyütüldü, liste görsel ağırlıklı;
 * TILE_ZOOM aynı kaldı ki merkez KADRAJ (1 Ağu revizesi) değişmesin —
 * matematik TILE_SIZE'a görece olduğundan aynı kesit sadece büyür. */
const TILE_SIZE = 96;
const TILE_ZOOM = 2.5;

/**
 * Placeholder zemin tonu — `lib/theme.ts` `photoTones` paletinden tarif
 * ADINA göre deterministik seçilir (RecipeCard ile aynı yaklaşım) ki aynı
 * tarif planda da hep aynı tonda görünsün.
 */
function toneForRecipe(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return photoTones[hash % photoTones.length][0];
}

/**
 * Planlanmış öğün kartı — birebir referans (Mutfagim.dc.html SCREEN 6):
 * beyaz kart radius 16 padding 9, solda 48×48 radius 12 görsel kutusu
 * (pastel zemin + ortada tarif emojisi), ortada tarif adı (500 14px, tek
 * satır) + öğün chip'i ve "{servings} kişilik · {kcal} kcal" meta satırı,
 * sağda X silme butonu (close 15px #C7B7A8).
 *
 * NOT: X butonu kart Pressable'ının İÇİNE konulmaz (iç içe buton — bkz.
 * RecipeCard'daki aynı karar); kartın ÜZERİNE absolute konumlanan bir
 * KARDEŞ Pressable'dır, kart içinde onun genişliği kadar boşluk bırakılır.
 */
export default function PlanEntryCard({ entry, onPress, onRemove }: PlanEntryCardProps) {
  const { t } = useTranslation();
  // Kullanıcı kararı (1 Ağu): planner kutusunda emoji yerine tarifin GERÇEK
  // görseli, ORİJİNALİN 4x zoom'lu merkez kadrajıyla gösterilir — 48×48
  // kutuda net dursun diye küçük thumbnail değil yüksek çözünürlüklü
  // orijinal kullanılır. Yalnız CACHE okunur, üretim tetiklenmez
  // (PlanEntry'de tam Recipe objesi yok); cache'te yoksa emoji'ye düşülür.
  const [tileUri] = useState<string | null>(() => {
    try {
      const cached = getCachedRecipeImage(entry.name);
      return cached?.originalUri ?? cached?.thumbnailUri ?? null;
    } catch {
      return null; // dosya sistemi yok (örn. web) — emoji placeholder
    }
  });
  return (
    <View className="flex-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('recipes.openRecipeA11y', { name: entry.name })}
        onPress={onPress}
        className="flex-1 flex-row items-center gap-[12px] rounded-2xl bg-white p-[10px] active:scale-95"
        style={cardShadow}>
        {/* Görsel kutusu — 96×96 radius 14 (2x kararı): tarif görseli varsa
            TILE_ZOOM kat büyütülmüş merkez kadraj (kutu overflow-hidden,
            negatif margin'le ortalanır), yoksa pastel zemin + ortada emoji. */}
        {tileUri ? (
          <View
            className="overflow-hidden rounded-[14px]"
            style={{ width: TILE_SIZE, height: TILE_SIZE }}>
            <Image
              source={{ uri: tileUri }}
              style={{
                width: TILE_SIZE * TILE_ZOOM,
                height: TILE_SIZE * TILE_ZOOM,
                marginLeft: (-TILE_SIZE * (TILE_ZOOM - 1)) / 2,
                marginTop: (-TILE_SIZE * (TILE_ZOOM - 1)) / 2,
              }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : (
          <View
            className="items-center justify-center rounded-[14px]"
            style={{ width: TILE_SIZE, height: TILE_SIZE, backgroundColor: toneForRecipe(entry.name) }}>
            <Text className="text-[40px]">{entry.emoji}</Text>
          </View>
        )}

        <View className="min-w-0 flex-1">
          {/* Kart 2x görselle yükseldi — ad iki satıra çıkabilir (kırpma azalır). */}
          <Text className="font-sans-medium text-[14.5px] text-ink" numberOfLines={2}>
            {entry.name}
          </Text>
          {/* 2x görselle metin sütunu daraldı — chip ve meta ALT ALTA
              (aynı satırda meta "2 servin…" diye kırpılıyordu). */}
          <View className="mt-[4px] flex-row">
            {/* Öğün chip'i — 600 10px #5C6B60, bg #EFF3EC (pillbg), radius 20. */}
            <View className="rounded-[20px] bg-pillbg px-2 py-[2px]">
              <Text className="font-sans-semibold text-[10px] text-[#5C6B60]">
                {t(`data.meal.${entry.meal}`, { defaultValue: entry.meal })}
              </Text>
            </View>
          </View>
          <Text className="mt-[4px] font-sans-medium text-[10.5px] text-qtymuted" numberOfLines={1}>
            {t('recipeDetail.servingsLabel', { count: entry.servings })} ·{' '}
            {t('recipeDetail.infoKcal', { kcal: entry.kcal })}
          </Text>
        </View>

        {/* X butonunun kapladığı alan için boşluk (buton kardeş Pressable). */}
        <View className="w-[27px]" />
      </Pressable>

      {/* Sağda X silme butonu — karta dokunmayı tetiklemez (kardeş eleman). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('plan.removeEntryA11y', { name: entry.name })}
        onPress={onRemove}
        hitSlop={8}
        className="absolute bottom-0 right-[9px] top-0 justify-center p-[6px] active:scale-90">
        <Ionicons name="close" size={15} color={colors.trashIcon} />
      </Pressable>
    </View>
  );
}
