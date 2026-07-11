import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui';
import { colors } from '@/lib/theme';

import { FacebookF, PLATFORM_COLORS, PlatformSquare, TiktokNote } from './PlatformSquare';

export interface SocialPlatformSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Geri butonu → Tarif Ekle menüsü. */
  onBack: () => void;
  /** Platform satırı seçimi — üçü de Instagram eğitimine gider (prototip kararı). */
  onPickPlatform: () => void;
}

/** Satır gölgesi — referans 587: 0 2px 8px -4px rgba(31,74,61,.12). */
const ROW_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 4,
  elevation: 2,
} as const;

/**
 * Sosyal platform seçim sheet'i — referans SOCIAL PLATFORM SHEET
 * (Mutfagim.dc.html 573-603): geri butonu + başlık, altında Instagram /
 * TikTok / Facebook satırları (üçü de aynı eğitim akışına gider).
 */
export function SocialPlatformSheet({
  visible,
  onClose,
  onBack,
  onPickPlatform,
}: SocialPlatformSheetProps) {
  const rows: { key: string; label: string; square: React.ReactNode }[] = [
    {
      key: 'instagram',
      label: 'Instagram',
      square: <PlatformSquare color={PLATFORM_COLORS.instagram} />,
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      square: (
        <PlatformSquare color={PLATFORM_COLORS.tiktok}>
          <TiktokNote />
        </PlatformSquare>
      ),
    },
    {
      key: 'facebook',
      label: 'Facebook',
      square: (
        <PlatformSquare color={PLATFORM_COLORS.facebook}>
          <FacebookF />
        </PlatformSquare>
      ),
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="mb-4 flex-row items-center gap-3">
        <Pressable
          onPress={onBack}
          accessibilityLabel="Geri"
          className="items-center justify-center rounded-full bg-sand active:scale-95"
          style={{ width: 34, height: 34 }}>
          <Ionicons name="chevron-back" size={17} color={colors.forest} />
        </Pressable>
        <Text className="font-serif text-[20px] text-ink">Sosyal medyadan aktar</Text>
      </View>

      <View style={{ gap: 11 }}>
        {rows.map((row) => (
          <Pressable
            key={row.key}
            onPress={onPickPlatform}
            className="flex-row items-center rounded-2xl bg-white active:scale-[0.98]"
            style={[{ paddingVertical: 15, paddingHorizontal: 16, gap: 13 }, ROW_SHADOW]}>
            {row.square}
            <Text className="flex-1 font-sans-semibold text-[15px] text-ink">{row.label}</Text>
            <Ionicons name="chevron-forward" size={17} color="#C7CFC9" />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
