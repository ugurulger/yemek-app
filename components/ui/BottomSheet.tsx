import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Üstteki 40×5 sürükleme çubuğu (referans sheet'lerinin hepsinde var). */
  showHandle?: boolean;
}

const OPEN_DURATION_MS = 300;
const CLOSE_DURATION_MS = 240;

// ---------------------------------------------------------------------------
// Kapanış kilidi (modül seviyesi): bir sheet kapanış animasyonunu bitirmeden
// başka bir sheet MOUNT edilmez. iOS'ta iki native Modal üst üste binerse
// (örn. ImportFlow'un zincirleme adım geçişleri: entry → menu) UIKit alttaki
// modal kapanırken üstüne sunulmuş yeni modalı da söker — yeni sheet hiç
// görünmez. Kilit, yeni sheet'in Modal'ını öncekinin sökümünden SONRAYA erteler.
// ---------------------------------------------------------------------------

let closingCount = 0;
const mountWaiters: (() => void)[] = [];

function beginClosing(): void {
  closingCount += 1;
}

function endClosing(): void {
  closingCount = Math.max(0, closingCount - 1);
  if (closingCount === 0) {
    for (const waiter of mountWaiters.splice(0)) waiter();
  }
}

/** Kapanmakta olan sheet yoksa hemen, varsa hepsi bitince çağırır. */
function whenNoClosingSheet(callback: () => void): void {
  if (closingCount === 0) callback();
  else mountWaiters.push(callback);
}

/**
 * Ortak bottom sheet — TÜM sheet açılışları bu component'ten geçer (İş 3):
 * arka plan kararması sheet'in yukarı çıkış hareketiyle SENKRON kademeli
 * artar (backdrop opacity = sheet ilerleme değeri; sheet ne kadar yukarıdaysa
 * kararma o kadar belirgin) ve tutamaçtan sürükleyerek kapatırken aynı
 * şekilde geri azalır. Animasyonlar Reanimated ile UI thread'inde koşar
 * (Modal'ın kendi "slide" animasyonu KULLANILMAZ — backdrop'la senkron
 * kurulamıyordu). Görsel iskelet birebir referans: rgba(20,30,25,.4)
 * karartma, krem (#F7F5F0) gövde, üst radius 28, padding 10/20/34, üstte
 * 40×5 kum rengi tutamaç. Karartmaya dokununca kapanır; içerik dokunuşları
 * kapanmayı tetiklemez.
 */
export function BottomSheet({ visible, onClose, children, showHandle = true }: BottomSheetProps) {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  // Modal, kapanış animasyonu bitene kadar mount kalır (visible=false olur
  // olmaz sökülürse çıkış animasyonu hiç görünmezdi).
  const [mounted, setMounted] = useState(visible);
  /** 0 = tamamen kapalı (sheet altta, karartma yok) → 1 = tamamen açık. */
  const progress = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  // Sürükleme başlangıcındaki ilerleme — hareket bu tabandan hesaplanır.
  const dragStartProgress = useRef(1);

  // Kapanış animasyonu sürerken kilidin iki kez alınmasını/bırakılmasını önler.
  const isClosingRef = useRef(false);

  function handleCloseAnimationEnd(finished: boolean) {
    if (!isClosingRef.current) return;
    isClosingRef.current = false;
    endClosing();
    // Animasyon iptal edildiyse (kapanış sürerken tekrar açıldı) mounted kalır.
    if (finished) setMounted(false);
  }

  useEffect(() => {
    if (visible) {
      // Kapanmakta olan başka bir sheet varsa (zincirleme geçiş) Modal'ın
      // mount'u onun sökümünden SONRAYA ertelenir — bkz. kapanış kilidi.
      let cancelled = false;
      whenNoClosingSheet(() => {
        if (cancelled) return;
        setMounted(true);
        progress.value = withTiming(1, {
          duration: OPEN_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        });
      });
      return () => {
        cancelled = true;
      };
    }
    if (mounted && !isClosingRef.current) {
      isClosingRef.current = true;
      beginClosing();
      // Kapanış mevcut ilerlemeden devam eder (sürüklemeyle yarıda bırakılmış
      // olabilir) — bitince Modal sökülür ve kilit bırakılır.
      progress.value = withTiming(
        0,
        { duration: CLOSE_DURATION_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          runOnJS(handleCloseAnimationEnd)(finished === true);
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Component kapanış ortasında tamamen sökülürse (örn. ekran değişimi)
  // kilit bırakılır — aksi halde sonraki hiçbir sheet mount olamazdı.
  useEffect(() => {
    return () => {
      if (isClosingRef.current) {
        isClosingRef.current = false;
        endClosing();
      }
    };
  }, []);

  // Tutamaçtan sürükleyerek kapatma. PanResponder her render'da yeniden
  // oluşturulur (useRef'e SARILMAZ) — aksi halde release handler'ı bayat
  // closure'a düşer (bkz. SKILL.md MVP-18 dersi). Kararma, progress'e bağlı
  // olduğu için sürükleme sırasında da senkron azalır/artar.
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => {
      dragStartProgress.current = progress.value;
    },
    onPanResponderMove: (_, gesture) => {
      const height = sheetHeight.value || windowHeight;
      const next = dragStartProgress.current - gesture.dy / height;
      progress.value = Math.min(1, Math.max(0, next));
    },
    onPanResponderRelease: (_, gesture) => {
      const height = sheetHeight.value || windowHeight;
      const shouldClose = gesture.dy > height * 0.35 || gesture.vy > 0.8;
      if (shouldClose) {
        // Parent visible=false yapar; çıkış animasyonu yukarıdaki effect'te
        // mevcut (sürüklenmiş) ilerlemeden devam eder.
        onClose();
      } else {
        progress.value = withTiming(1, {
          duration: OPEN_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const sheetStyle = useAnimatedStyle(() => {
    const height = sheetHeight.value || windowHeight;
    return { transform: [{ translateY: (1 - progress.value) * height }] };
  });

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* Klavye düzeltmesi (kullanıcı raporu — "Add a Cookbook" isim kutusu):
          sheet ekranın ALTINA hizalı olduğu için native Modal içinde klavye
          açılınca içerik klavyenin ALTINDA kalıyordu — kullanıcı yazdığını
          GÖREMİYORDU (autoFocus'lu isim girişi). KeyboardAvoidingView sheet'i
          klavyenin üstüne iter; klavye yokken hiçbir etkisi yoktur (Android'de
          adjustResize zaten yeterli, behavior yalnızca iOS'ta gerekir). */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityLabel={t('common.closeSheetA11y')}
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          style={sheetStyle}
          onLayout={(event) => {
            sheetHeight.value = event.nativeEvent.layout.height;
          }}>
          <View className="rounded-t-[28px] bg-cream px-5 pb-[34px]">
            {showHandle ? (
              // Tutamaç bölgesi sürükleme alanıdır — dokunma alanı geniş
              // tutulur (üst padding + tutamaç + alt boşluk ≈ 31px şerit).
              <View {...panResponder.panHandlers} className="items-center pb-4 pt-2.5">
                <View className="h-[5px] w-10 rounded-[20px] bg-[#D6D2C8]" />
              </View>
            ) : (
              <View className="pt-2.5" />
            )}
            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,30,25,0.4)',
  },
});
