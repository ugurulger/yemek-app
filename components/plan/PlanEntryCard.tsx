import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';

import { cardShadow, colors, photoTones } from '@/lib/theme';
import type { PlanEntry } from '@/store/planStore';

interface PlanEntryCardProps {
  entry: PlanEntry;
  onPress: () => void;
  onRemove: () => void;
}

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
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('recipes.openRecipeA11y', { name: entry.name })}
        onPress={onPress}
        className="flex-row items-center gap-[11px] rounded-2xl bg-white p-[9px] active:scale-95"
        style={cardShadow}>
        {/* Görsel kutusu — 48×48 radius 12, pastel zemin + ortada emoji. */}
        <View
          className="h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: toneForRecipe(entry.name) }}>
          <Text className="text-[22px]">{entry.emoji}</Text>
        </View>

        <View className="min-w-0 flex-1">
          <Text className="font-sans-medium text-[14px] text-ink" numberOfLines={1}>
            {entry.name}
          </Text>
          <View className="mt-[3px] flex-row items-center gap-[7px]">
            {/* Öğün chip'i — 600 10px #5C6B60, bg #EFF3EC (pillbg), radius 20. */}
            <View className="rounded-[20px] bg-pillbg px-2 py-[2px]">
              <Text className="font-sans-semibold text-[10px] text-[#5C6B60]">
                {t(`data.meal.${entry.meal}`, { defaultValue: entry.meal })}
              </Text>
            </View>
            <Text className="font-sans-medium text-[10.5px] text-qtymuted" numberOfLines={1}>
              {t('recipeDetail.servingsLabel', { count: entry.servings })} ·{' '}
              {t('recipeDetail.infoKcal', { kcal: entry.kcal })}
            </Text>
          </View>
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
