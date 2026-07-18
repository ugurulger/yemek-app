import { useEffect, useRef } from 'react';
import { Animated, Modal, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export interface InstagramLaunchScreenProps {
  visible: boolean;
  onClose: () => void;
}

const DOT_COLOR = '#4C8DF6';

/**
 * Nabız atan 12px mavi nokta — referans micpulse animasyonunun basit
 * Animated.opacity karşılığı; her nokta gecikmeli başlar.
 */
function PulseDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity]);

  return (
    <Animated.View
      style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: DOT_COLOR, opacity }}
    />
  );
}

/**
 * "Instagram açılıyor…" ara ekranı — referans INSTAGRAM LAUNCH
 * (Mutfagim.dc.html 667-677): beyaz tam ekran, 3 mavi nabız noktası +
 * serif başlık. Feed'e geçiş zamanlayıcısı host'ta (ImportFlow) yaşar.
 */
export function InstagramLaunchScreen({ visible, onClose }: InstagramLaunchScreenProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-white" style={{ gap: 18 }}>
        <View className="flex-row" style={{ gap: 8 }}>
          <PulseDot delay={0} />
          <PulseDot delay={200} />
          <PulseDot delay={400} />
        </View>
        <Text className="font-serif text-[17px] text-ink">{t('importFlow.igOpening')}</Text>
      </View>
    </Modal>
  );
}
