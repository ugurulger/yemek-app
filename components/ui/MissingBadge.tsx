import { Text, View } from 'react-native';

export interface MissingBadgeProps {
  count?: number;
  /**
   * Referanstaki üç varyant (Mutfagim.dc.html):
   * - 'card': tarif kartı sol üst — 600 10px, padding 4×9, gölge 0 3px 8px -2px rgba(180,90,10,.5)
   * - 'hero': detay hero sağ üst — 600 11px, padding 6×12, gölge 0 4px 10px -2px rgba(180,90,10,.5)
   * - 'micro': malzeme satırı — "eksik" metni, 600 10px #B26A16, bg #FBE6C9, padding 3×9
   */
  variant?: 'card' | 'hero' | 'micro';
}

const AMBER_SHADOW = {
  shadowColor: '#B45A0A',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.5,
  shadowRadius: 4,
  elevation: 3,
} as const;

/** Amber eksik rozeti — birebir referans değerleriyle. */
export function MissingBadge({ count, variant = 'card' }: MissingBadgeProps) {
  if (variant === 'micro') {
    return (
      <View className="self-start rounded-[20px] bg-amber-soft px-[9px] py-[3px]">
        <Text className="font-sans-semibold text-[10px] text-amber-text">eksik</Text>
      </View>
    );
  }

  const isHero = variant === 'hero';
  return (
    <View
      className={`self-start rounded-[20px] bg-amber ${isHero ? 'px-3 py-[6px]' : 'px-[9px] py-1'}`}
      style={AMBER_SHADOW}>
      <Text className={`font-sans-semibold text-white ${isHero ? 'text-[11px]' : 'text-[10px]'}`}>
        {count} eksik
      </Text>
    </View>
  );
}
