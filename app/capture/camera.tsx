import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import i18n from '@/src/i18n';
import { RecordProgressRing } from '@/components/capture/RecordProgressRing';
import { PrimaryButton } from '@/components/ui';
import { useCaptureStore } from '@/store/captureStore';
import { showToast } from '@/store/toastStore';

/** Basılı-tut kaydının üst sınırı (sn) — halka bu sürede tam dolar. */
const MAX_RECORD_SECONDS = 10;
/** İlerleme halkası konteyneri — referans 564: 104×104. */
const RING_SIZE = 104;
/** Beyaz kayıt butonunun çapı — referans 569: 76×76. */
const BUTTON_SIZE = 76;
/** Halka çizgisi — referans 566-567: yarıçap 47, kalınlık 5. */
const RING_RADIUS = 47;
const RING_STROKE = 5;
/** Zemin ve halka renkleri — referans 554/566-567. */
const CAMERA_BG = '#14100C';
const RING_TRACK_COLOR = 'rgba(255,255,255,0.25)';
const RING_FILL_COLOR = '#E38A2A';

/** Web fallback şerit dokusu — referans 555: 120°, 22px #2a2620/#221f19. */
const STRIPE_WIDTH = 22;
const BAND_SIZE = 1600;
const STRIPE_COUNT = Math.ceil(BAND_SIZE / (STRIPE_WIDTH * 2));
const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
};

/**
 * Uzantıdan mime tahmini (.mov → video/quicktime, .mp4 → video/mp4);
 * bilinmiyorsa iOS varsayılanı video/quicktime (recordAsync .mov üretir).
 */
function guessVideoMimeType(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase();
  return (extension && VIDEO_MIME_BY_EXTENSION[extension]) || 'video/quicktime';
}

/**
 * Web fallback zemini — kamera yok; referans 554-556'nın şeritli dokusu
 * (120° = 30° döndürülmüş dikey bantlar, PhotoPlaceholder tekniği) + ortada
 * mono 500 12px rgba(255,255,255,.25) ls 1 "canlı kamera görünümü" etiketi.
 */
function CameraWebBackdrop() {
  return (
    <View className="flex-1 overflow-hidden" style={{ backgroundColor: '#2a2620' }}>
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
          transform: [{ rotate: '30deg' }],
        }}>
        {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
          <View
            key={i}
            style={{
              width: STRIPE_WIDTH,
              height: BAND_SIZE,
              marginRight: STRIPE_WIDTH,
              backgroundColor: '#221f19',
            }}
          />
        ))}
      </View>
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <Text
          style={{
            fontFamily: MONO_FONT,
            fontSize: 12,
            fontWeight: '500',
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: 1,
          }}>
          {i18n.t('camera.liveViewLabel')}
        </Text>
      </View>
    </View>
  );
}

/**
 * Tam ekran koyu kamera — basılı tutarak video kaydı; görsel değerler
 * BİREBİR referans: design/reference/Mutfagim.dc.html satır 552-578 +
 * 993-998. Kayıt bitince video captureStore'a bırakılır ve geri dönülür;
 * analizi Mutfağım ekranı başlatır.
 */
export default function CameraCaptureScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setPendingVideo = useCaptureStore((state) => state.setPendingVideo);
  // mode=recipe: "+" Tarif Ekle akışının "Fotoğraftan" girişi — envanter
  // analiz köprüsü (pendingVideo) TETİKLENMEZ, özellik henüz MVP dışı.
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isRecipeMode = mode === 'recipe';
  const isWeb = Platform.OS === 'web';

  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(MAX_RECORD_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  /** 0 = beyaz daire, 1 = kayıtta (scale .62, radius 20, amber) — 150ms geçiş. */
  const recordButtonAnim = useRef(new Animated.Value(0)).current;

  useEffect(
    () => () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    },
    []
  );

  function finishWithVideo(uri: string, mimeType: string) {
    if (isRecipeMode) {
      // Tarif modu: fotoğraftan tarif çıkarımı henüz yok — envanter
      // analizini yanlışlıkla başlatmamak için köprüye video BIRAKILMAZ.
      showToast(t('camera.photoRecipeSoon'));
      router.back();
      return;
    }
    setPendingVideo({ uri, mimeType });
    router.back();
  }

  function stopCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  async function handleRecordPressIn() {
    if (!cameraRef.current || !isCameraReady || isRecording) {
      return;
    }
    setIsRecording(true);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: MAX_RECORD_SECONDS * 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    // Referans 997: kayıtta scale .62 + radius 20 + amber, 150ms geçiş.
    Animated.timing(recordButtonAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
    // Referans recHint (998): kayıttayken "{kalan} sn" geri sayımı.
    setRemainingSeconds(MAX_RECORD_SECONDS);
    countdownRef.current = setInterval(() => {
      setRemainingSeconds((s) => Math.max(s - 1, 0));
    }, 1000);

    try {
      // Promise, stopRecording çağrılınca veya maxDuration dolunca çözülür.
      const video = await cameraRef.current.recordAsync({ maxDuration: MAX_RECORD_SECONDS });
      if (video?.uri) {
        finishWithVideo(video.uri, guessVideoMimeType(video.uri));
        return;
      }
      Alert.alert(t('camera.recordFailedTitle'), t('camera.recordFailedTooShort'));
    } catch {
      Alert.alert(t('camera.recordFailedTitle'), t('camera.recordFailedGeneric'));
    } finally {
      setIsRecording(false);
      stopCountdown();
      progress.stopAnimation();
      progress.setValue(0);
      Animated.timing(recordButtonAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
  }

  function handleRecordPressOut() {
    if (isRecording) {
      cameraRef.current?.stopRecording();
    }
  }

  async function handlePickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('camera.permissionNeededTitle'), t('camera.galleryPermissionBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
    });
    if (result.canceled || result.assets.length === 0) {
      return;
    }
    const asset = result.assets[0];
    finishWithVideo(asset.uri, asset.mimeType ?? guessVideoMimeType(asset.uri));
  }

  async function handleRequestPermissions() {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
    }
    if (!micPermission?.granted) {
      await requestMicPermission();
    }
  }

  // Kapat — referans 557: 40×40 daire, bg rgba(0,0,0,.4), X 20 beyaz.
  const closeButton = (
    <Pressable
      onPress={() => router.back()}
      className="h-10 w-10 items-center justify-center rounded-full active:scale-95"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <Ionicons name="close" size={20} color="#FFFFFF" />
    </Pressable>
  );

  if (!isWeb) {
    // İzin durumları henüz yüklenmediyse boş koyu ekran.
    if (!cameraPermission || !micPermission) {
      return <View className="flex-1" style={{ backgroundColor: CAMERA_BG }} />;
    }

    // İzin isteme ekranı (kamera veya mikrofon eksikse).
    if (!cameraPermission.granted || !micPermission.granted) {
      return (
        <SafeAreaView className="flex-1 bg-ink">
          <View className="px-5 pt-2">{closeButton}</View>
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="videocam-outline" size={40} color="#96A199" />
            <Text className="mt-4 text-center font-serif text-xl text-white">
              {t('camera.cameraPermissionTitle')}
            </Text>
            <Text className="mt-2 mb-6 text-center font-sans text-sm text-muted2">
              {t('camera.cameraPermissionBody')}
            </Text>
            <PrimaryButton label={t('camera.grantPermission')} onPress={handleRequestPermissions} />
          </View>
        </SafeAreaView>
      );
    }
  }

  const buttonScale = recordButtonAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.62] });
  const buttonRadius = recordButtonAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BUTTON_SIZE / 2, 20],
  });
  const buttonColor = recordButtonAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', RING_FILL_COLOR],
  });

  return (
    <View className="flex-1" style={{ backgroundColor: CAMERA_BG }}>
      {/* Zemin: gerçek kamerada CameraView; web'de şeritli doku + mono etiket. */}
      {isWeb ? (
        <CameraWebBackdrop />
      ) : (
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          mode="video"
          onCameraReady={() => setIsCameraReady(true)}
        />
      )}

      {/* Kapat — referans 557: top 52, left 20. */}
      <View style={{ position: 'absolute', top: 52, left: 20 }}>{closeButton}</View>

      {/* İpucu — referans 560: top 60 ortalı 500 14px beyaz;
          kayıttayken kalan saniye geri sayımı. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 60, left: 0, right: 0 }}>
        <Text className="text-center font-sans-medium text-[14px] text-white">
          {isRecording
            ? t('camera.remainingSeconds', { count: remainingSeconds })
            : t('camera.holdToRecord')}
        </Text>
      </View>

      {/* Kayıt halkası — referans 563-571: bottom 44 ortalı, 104×104. */}
      <View style={{ position: 'absolute', bottom: 44, left: 0, right: 0, alignItems: 'center' }}>
        <View
          className="items-center justify-center"
          style={{ width: RING_SIZE, height: RING_SIZE }}>
          {isRecording ? (
            <View className="absolute inset-0">
              <RecordProgressRing
                progress={progress}
                size={RING_SIZE}
                color={RING_FILL_COLOR}
                trackColor={RING_TRACK_COLOR}
              />
            </View>
          ) : (
            // Boşta iz halkası: yarıçap 47, kalınlık 5, rgba(255,255,255,.25).
            <View
              style={{
                position: 'absolute',
                width: RING_RADIUS * 2 + RING_STROKE,
                height: RING_RADIUS * 2 + RING_STROKE,
                borderRadius: RING_RADIUS + RING_STROKE / 2,
                borderWidth: RING_STROKE,
                borderColor: RING_TRACK_COLOR,
              }}
            />
          )}
          <Pressable
            onPressIn={handleRecordPressIn}
            onPressOut={handleRecordPressOut}
            disabled={!isCameraReady}
            style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}>
            <Animated.View
              style={{
                flex: 1,
                backgroundColor: buttonColor,
                borderRadius: buttonRadius,
                transform: [{ scale: buttonScale }],
                opacity: isWeb || isCameraReady ? 1 : 0.5,
              }}
            />
          </Pressable>
        </View>
      </View>

      {/* Galeri — referans 572-575: bottom 64 right 34; 52×52 radius 14,
          çerçeve 1.5px rgba(255,255,255,.4), bg rgba(255,255,255,.08). */}
      <View style={{ position: 'absolute', bottom: 64, right: 34 }}>
        <Pressable
          onPress={handlePickFromGallery}
          className="items-center justify-center active:scale-95"
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.4)',
            backgroundColor: 'rgba(255,255,255,0.08)',
          }}>
          <Ionicons name="images-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}
