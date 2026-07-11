import { Animated, View } from 'react-native';

export interface RecordProgressRingProps {
  /** 0 → 1 arası ilerleme (kayıt süresince 10 sn'de dolar). */
  progress: Animated.Value;
  /** Halkanın dış çapı (piksel). */
  size: number;
  /** Dolan kısmın rengi. */
  color?: string;
  /** Boş kısmın (track) rengi. */
  trackColor?: string;
}

/**
 * Story tarzı, saat yönünde dolan ilerleme halkası — react-native-svg
 * KULLANMADAN, saf View'larla "iki yarım daire + rotate" (pasta dilimi)
 * tekniği (spec §3, kamera kayıt butonu):
 *
 * - Dış container: track renginde tam bir disk.
 * - İki "pencere" (sol/sağ yarı, overflow hidden) içinde birer yarım disk
 *   döner; sağ pencere %0-50'yi, sol pencere %50-100'ü süpürür. Yarım disk
 *   kendi merkezinde değil DAİRENİN merkezinde dönsün diye transform'da
 *   translateX(±r/2) pivot kaydırması yapılır.
 * - Ortadaki beyaz kayıt butonu bu diskin ÜZERİNE çizildiği için (bkz.
 *   app/capture/camera.tsx) sadece kenarda kalan halka bölgesi görünür —
 *   pasta dolgusu halka gibi okunur.
 */
export function RecordProgressRing({
  progress,
  size,
  color = '#FFFFFF',
  trackColor = 'rgba(255,255,255,0.3)',
}: RecordProgressRingProps) {
  const radius = size / 2;

  // Sağ pencere %0-50 arasında 0° → 180° döner, sonra sabit kalır.
  const rightRotate = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '180deg', '180deg'],
  });
  // Sol pencere %50'ye kadar bekler, %50-100 arasında 0° → 180° döner.
  const leftRotate = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '0deg', '180deg'],
  });

  return (
    <View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: trackColor,
        overflow: 'hidden',
      }}>
      {/* Sağ yarı penceresi: %0-50 dilimini gösterir. */}
      <View
        style={{
          position: 'absolute',
          left: radius,
          top: 0,
          width: radius,
          height: size,
          overflow: 'hidden',
        }}>
        <Animated.View
          style={{
            position: 'absolute',
            // Başlangıçta dairenin SOL yarısını kaplar (pencere dışında,
            // görünmez); dönerken sağ pencereye süpürülür.
            left: -radius,
            top: 0,
            width: radius,
            height: size,
            backgroundColor: color,
            borderTopLeftRadius: radius,
            borderBottomLeftRadius: radius,
            transform: [
              { translateX: radius / 2 },
              { rotate: rightRotate },
              { translateX: -radius / 2 },
            ],
          }}
        />
      </View>
      {/* Sol yarı penceresi: %50-100 dilimini gösterir. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: radius,
          height: size,
          overflow: 'hidden',
        }}>
        <Animated.View
          style={{
            position: 'absolute',
            // Başlangıçta dairenin SAĞ yarısını kaplar (pencere dışında,
            // görünmez); dönerken sol pencereye süpürülür.
            left: radius,
            top: 0,
            width: radius,
            height: size,
            backgroundColor: color,
            borderTopRightRadius: radius,
            borderBottomRightRadius: radius,
            transform: [
              { translateX: -radius / 2 },
              { rotate: leftRotate },
              { translateX: radius / 2 },
            ],
          }}
        />
      </View>
    </View>
  );
}
