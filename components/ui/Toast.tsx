import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { useToastStore } from '@/store/toastStore';

/**
 * Toast host — referans TOAST bloğu birebir: alt navigasyonun üstünde
 * (bottom 110), ortalanmış koyu (#23302B) pill, 600 13px beyaz metin,
 * popIn (opacity + 6px yukarı) girişi. app/_layout.tsx'te bir kez monte
 * edilir; mesaj store'dan gelir (store/toastStore.ts).
 *
 * NOT: Animated.View, NativeWind className'lerini almadığı için stiller
 * StyleSheet ile verilir (className kullanılmaz — canlı testte konumun
 * uygulanmadığı görüldü).
 */
export function ToastHost() {
  const message = useToastStore((state) => state.message);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  }, [message, anim]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          ],
        },
      ]}>
      <Animated.View style={styles.pill}>
        <Text numberOfLines={1} style={styles.text}>
          {message}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 70,
    elevation: 12,
  },
  pill: {
    backgroundColor: '#23302B',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxWidth: '86%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  text: {
    color: '#FFFFFF',
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 13,
  },
});
