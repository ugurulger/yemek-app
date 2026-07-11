import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui';
import { colors } from '@/lib/theme';

export interface InstagramEduSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Aktif eğitim adımı (0-2) — state host'ta yaşar (kapanışta sıfırlansın diye). */
  page: number;
  onPrev: () => void;
  onNext: () => void;
  /** 'Instagram'ı aç' → launch taklidi. */
  onLaunch: () => void;
  /** 'Örnek tarifle dene' → doğrudan import. */
  onImportSample: () => void;
}

const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/** Kart gölgesi — referans 613: 0 4px 16px -8px rgba(31,74,61,.2). */
const EDU_CARD_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.18,
  shadowRadius: 6,
  elevation: 3,
} as const;

/** Adım rozetlerinin ortak gölgesi — referans 617: 0 4px 12px -3px rgba(0,0,0,.2). */
const STEP_BADGE_SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.18,
  shadowRadius: 5,
  elevation: 4,
} as const;

/** İleri/geri ok butonu — 30×30 sand daire (referans 640-651). */
function ArrowButton({
  direction,
  onPress,
}: {
  direction: 'back' | 'forward';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={direction === 'back' ? 'Önceki adım' : 'Sonraki adım'}
      className="items-center justify-center rounded-full bg-sand active:scale-95"
      style={{ width: 30, height: 30 }}>
      <Ionicons name={direction === 'back' ? 'chevron-back' : 'chevron-forward'} size={15} color={colors.forest} />
    </Pressable>
  );
}

/**
 * Instagram eğitim sheet'i — referans INSTAGRAM EDU SHEET (Mutfagim.dc.html
 * 605-665): beyaz kart içinde 3 adımlı "nasıl paylaşılır" anlatımı (igPage),
 * nokta göstergesi, 'Instagram'ı aç' CTA'sı ve 'Örnek tarifle dene' linki.
 */
export function InstagramEduSheet({
  visible,
  onClose,
  page,
  onPrev,
  onNext,
  onLaunch,
  onImportSample,
}: InstagramEduSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mb-4 text-center font-serif text-[21px] text-ink">
        Instagram'dan içe aktar
      </Text>

      {/* Adım kartı — referans 613: radius 20, minHeight 270. */}
      <View
        className="rounded-[20px] bg-white"
        style={[
          { minHeight: 270, paddingTop: 20, paddingHorizontal: 18, paddingBottom: 16 },
          EDU_CARD_SHADOW,
        ]}>
        {page === 0 && (
          <>
            {/* Kahverengi gönderi placeholder'ı + alta bindirilmiş Gönder dairesi. */}
            <View
              className="items-center justify-center"
              style={{ height: 150, borderRadius: 14, backgroundColor: '#8B5E3C' }}>
              <Text
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 10,
                  fontWeight: '500',
                  color: 'rgba(255,255,255,0.6)',
                }}>
                tarif gönderisi
              </Text>
              <View
                className="items-center justify-center rounded-full bg-white"
                style={[
                  {
                    position: 'absolute',
                    bottom: -14,
                    alignSelf: 'center',
                    width: 44,
                    height: 44,
                    borderWidth: 3,
                    borderColor: colors.amber,
                  },
                  STEP_BADGE_SHADOW,
                ]}>
                <Ionicons name="paper-plane-outline" size={20} color={colors.forest} />
              </View>
            </View>
            <Text
              className="text-center font-sans-semibold text-[15px] text-ink"
              style={{ marginTop: 26, marginBottom: 4 }}>
              1. Gönderide <Text style={{ color: colors.amber }}>Gönder</Text>'e dokun
            </Text>
            <Text className="text-center font-sans text-[12.5px] text-muted">
              Beğendiğin tarif gönderisini aç
            </Text>
          </>
        )}

        {page === 1 && (
          <>
            <View
              className="items-center justify-end bg-sand"
              style={{ height: 150, borderRadius: 14, paddingBottom: 16 }}>
              <View
                className="items-center justify-center bg-white"
                style={[
                  {
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    borderWidth: 3,
                    borderColor: colors.amber,
                  },
                  STEP_BADGE_SHADOW,
                ]}>
                <Ionicons name="share-outline" size={22} color={colors.forest} />
              </View>
            </View>
            <Text
              className="text-center font-sans-semibold text-[15px] text-ink"
              style={{ marginTop: 20, marginBottom: 4 }}>
              2. <Text style={{ color: colors.amber }}>Paylaş</Text> menüsünü aç
            </Text>
            <Text className="text-center font-sans text-[12.5px] text-muted">
              Sistemin paylaş sayfası açılır
            </Text>
          </>
        )}

        {page === 2 && (
          <>
            <View
              className="items-center justify-center bg-sand"
              style={{ height: 150, borderRadius: 14 }}>
              <View
                className="items-center justify-center bg-forest"
                style={[
                  {
                    width: 58,
                    height: 58,
                    borderRadius: 16,
                    borderWidth: 3,
                    borderColor: colors.amber,
                  },
                  STEP_BADGE_SHADOW,
                ]}>
                <Text style={{ fontSize: 22 }}>🍳</Text>
                <Text className="font-sans-semibold" style={{ fontSize: 8, color: '#FFFFFF' }}>
                  Mutfağım
                </Text>
              </View>
            </View>
            <Text
              className="text-center font-sans-semibold text-[15px] text-ink"
              style={{ marginTop: 20, marginBottom: 4 }}>
              3. <Text style={{ color: colors.forest }}>Mutfağım</Text>'ı seç
            </Text>
            <Text className="text-center font-sans text-[12.5px] text-muted">
              Tarif otomatik olarak aktarılır
            </Text>
          </>
        )}

        {/* Sol/sağ üst köşe ok butonları — referans 640-651. */}
        <View style={{ position: 'absolute', top: 20, left: 16 }}>
          <ArrowButton direction="back" onPress={onPrev} />
        </View>
        <View style={{ position: 'absolute', top: 20, right: 16 }}>
          <ArrowButton direction="forward" onPress={onNext} />
        </View>
      </View>

      {/* Nokta göstergesi — aktif 22px koyu, diğerleri 7px kum (referans 654-658). */}
      <View
        className="flex-row justify-center"
        style={{ gap: 6, marginTop: 14, marginBottom: 16 }}>
        {[0, 1, 2].map((dot) => (
          <View
            key={dot}
            style={{
              width: dot === page ? 22 : 7,
              height: 7,
              borderRadius: 20,
              backgroundColor: dot === page ? colors.ink : '#D6D2C8',
            }}
          />
        ))}
      </View>

      {/* CTA — referans 660: bg forest, 600 15 beyaz, radius 16, padding 15. */}
      <Pressable
        onPress={onLaunch}
        className="w-full items-center rounded-2xl bg-forest active:scale-[0.98]"
        style={{
          padding: 15,
          shadowColor: '#1F4A3D',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.35,
          shadowRadius: 7,
          elevation: 4,
        }}>
        <Text className="font-sans-semibold text-[15px] text-white">Instagram'ı aç</Text>
      </Pressable>
      <Pressable
        onPress={onImportSample}
        className="w-full items-center active:opacity-70"
        style={{ paddingTop: 12, paddingBottom: 2 }}>
        <Text className="font-sans-semibold text-[13px] text-forest">Örnek tarifle dene</Text>
      </Pressable>
    </BottomSheet>
  );
}
