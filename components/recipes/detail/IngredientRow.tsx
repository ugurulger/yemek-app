import { Text, View } from 'react-native';

import { MissingBadge } from '@/components/ui';
import { colors } from '@/lib/theme';

export interface IngredientRowProps {
  name: string;
  /** Sağdaki muted metin: "250 g · 360 kcal" (ölçeklenmiş miktar + kalori). */
  detailText: string;
  /** CANLI envanter/kiler durumuna göre eksik mi (computeMissing sonucu). */
  missing: boolean;
}

/**
 * Malzeme satırı — BİREBİR referans (SCREEN 3): padding 11px 0, HER satırda
 * üst çizgi 1px rgba(31,74,61,.07), gap 10; solda 6×6 #C7D0C9 nokta + ad
 * 500 14px #3A463F; sağda "{miktar} {birim} · {kcal} kcal" 500 11.5px
 * #98A29A; eksikse amber "eksik" mikro-rozeti (gap 8).
 */
export default function IngredientRow({ name, detailText, missing }: IngredientRowProps) {
  return (
    <View
      className="flex-row items-center justify-between gap-2.5 py-[11px]"
      style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
      <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
        <View
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: colors.ingredientDot }}
        />
        <Text className="font-sans-medium text-[14px] text-body" numberOfLines={1}>
          {name}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="font-sans-medium text-[11.5px] text-qtymuted">{detailText}</Text>
        {missing && <MissingBadge variant="micro" />}
      </View>
    </View>
  );
}
