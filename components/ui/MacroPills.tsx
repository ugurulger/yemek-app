import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/lib/theme';

export interface MacroPillsProps {
  /** Gram değerleri — çeviri anahtarları recipeDetail.macro* üzerinden basılır. */
  protein: number;
  carbs: number;
  fat: number;
  className?: string;
}

/**
 * P8-3: Protein/Carbs/Fat makro pillerinin TEK ortak bileşeni — tarif
 * detayı, kartlar ve planner hep bunu kullanır ki tipografi, dot renkleri
 * ve zemin her yerde birebir aynı olsun (store görselindeki iki kart
 * arasındaki tasarım farkının kök nedeni: kopyalanmış ad-hoc pill stilleri).
 * Stil referansı: soluk yeşil zemin (pillbg), 7px renkli nokta, 600 12px
 * gövde metni — design/reference SCREEN 3 makro satırı.
 */
export function MacroPills({ protein, carbs, fat, className }: MacroPillsProps) {
  const { t } = useTranslation();
  const pills = [
    { label: t('recipeDetail.macroProtein', { grams: protein }), dot: colors.macroProtein },
    { label: t('recipeDetail.macroCarb', { grams: carbs }), dot: colors.macroKarb },
    { label: t('recipeDetail.macroFat', { grams: fat }), dot: colors.macroYag },
  ];
  return (
    <View className={`flex-row gap-2 ${className ?? ''}`}>
      {pills.map((pill) => (
        <View
          key={pill.label}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[14px] bg-pillbg p-[9px]">
          <View className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: pill.dot }} />
          <Text className="font-sans-semibold text-[12px] text-body">{pill.label}</Text>
        </View>
      ))}
    </View>
  );
}
