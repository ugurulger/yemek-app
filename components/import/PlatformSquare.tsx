import { ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

/**
 * 34×34 radius 10 platform karesi — referans ADD-RECIPE MENU / SOCIAL
 * PLATFORM sheet'lerindeki IG/TikTok/Facebook kareleri. Instagram'ın
 * gradyanı paket eklememek için düz #DD2A7B ile yaklaşıklanır (görev
 * kararı — expo-linear-gradient YOK).
 */
export const PLATFORM_COLORS = {
  instagram: '#DD2A7B',
  tiktok: '#111111',
  facebook: '#1877F2',
} as const;

export interface PlatformSquareProps {
  color: string;
  /** Kare içi içerik (TikTok ♪, Facebook f) — yoksa düz renk. */
  children?: ReactNode;
  style?: ViewStyle;
}

export function PlatformSquare({ color, children, style }: PlatformSquareProps) {
  return (
    <View
      className="items-center justify-center"
      style={[{ width: 34, height: 34, borderRadius: 10, backgroundColor: color }, style]}>
      {children}
    </View>
  );
}

/** TikTok karesinin beyaz ♪ işareti — referans 589: 800 16 beyaz. */
export function TiktokNote() {
  return <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>♪</Text>;
}

/** Facebook karesinin beyaz serif f'i — referans 595: 800 18 Georgia. */
export function FacebookF() {
  return (
    <Text className="font-serif" style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF' }}>
      f
    </Text>
  );
}
