import { ReactNode } from 'react';
import { Platform, StyleProp, Text, View, ViewStyle } from 'react-native';

import { colors } from '../../lib/theme';

export interface PhotoPlaceholderProps {
  tone1: string;
  tone2: string;
  label: string;
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Şerit genişliği — referans: repeating-linear-gradient(135deg, t1 0 16px,
 * t2 16px 32px) → 16px çizgi + 16px boşluk.
 */
const STRIPE_WIDTH = 16;
/** Döndürülmüş şerit bandının her yönde konteyneri aşacak kadar büyük kenarı. */
const BAND_SIZE = 1200;
const STRIPE_COUNT = Math.ceil(BAND_SIZE / (STRIPE_WIDTH * 2));

const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/**
 * Diagonal çizgili fotoğraf placeholder'ı — BİREBİR referans
 * (design/reference/Mutfagim.dc.html `photoStyleOf`):
 * CSS 135deg = RN'de 45° döndürülmüş dikey şeritler; etiket
 * `500 10px monospace, rgba(31,74,61,.4), letter-spacing .5`.
 *
 * Konteyneri doldurur; boyutu üst View / className belirler.
 * children slot'u üstüne rozet vb. bindirmek içindir.
 */
export function PhotoPlaceholder({
  tone1,
  tone2,
  label,
  children,
  className = '',
  style,
}: PhotoPlaceholderProps) {
  return (
    <View
      className={`overflow-hidden ${className}`}
      style={[{ backgroundColor: tone1 }, style]}>
      {/* Diagonal şerit bandı — konteynerden büyük, ortalanmış, 45° döndürülmüş
          (CSS 135deg gradient yönünün RN karşılığı) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: BAND_SIZE,
          height: BAND_SIZE,
          marginTop: -BAND_SIZE / 2,
          marginLeft: -BAND_SIZE / 2,
          flexDirection: 'row',
          transform: [{ rotate: '45deg' }],
        }}>
        {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
          <View
            key={i}
            style={{
              width: STRIPE_WIDTH,
              height: BAND_SIZE,
              marginRight: STRIPE_WIDTH,
              backgroundColor: tone2,
            }}
          />
        ))}
      </View>
      {/* Ortadaki monospace etiket (500 10px, rgba(31,74,61,.4), ls .5) */}
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <Text
          className="text-[10px]"
          style={{ fontFamily: MONO_FONT, fontWeight: '500', color: colors.photoLabel, letterSpacing: 0.5 }}>
          {label}
        </Text>
      </View>
      {/* Üstüne bindirilecek içerik (rozet vb.) */}
      {children}
    </View>
  );
}
