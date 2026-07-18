import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from '@/components/ui';
import { colors } from '@/lib/theme';

import { FacebookF, PLATFORM_COLORS, PlatformSquare, TiktokNote } from './PlatformSquare';

export interface SocialPlatformSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Geri butonu → Tarif Ekle menüsü. */
  onBack: () => void;
  /** Platform satırı seçimi — YALNIZ Instagram (diğerleri "Coming soon"). */
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
  const { t } = useTranslation();
  // Yalnız Instagram implemente (kullanıcı kararı) — diğerleri market
  // lansmanından sonra; listede görünür ama "Coming soon" ile disabled.
  const rows: { key: string; label: string; square: React.ReactNode; enabled: boolean }[] = [
    {
      key: 'instagram',
      label: 'Instagram',
      square: <PlatformSquare color={PLATFORM_COLORS.instagram} />,
      enabled: true,
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      square: (
        <PlatformSquare color={PLATFORM_COLORS.tiktok}>
          <TiktokNote />
        </PlatformSquare>
      ),
      enabled: false,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      square: (
        <PlatformSquare color={PLATFORM_COLORS.facebook}>
          <FacebookF />
        </PlatformSquare>
      ),
      enabled: false,
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="mb-4 flex-row items-center gap-3">
        <Pressable
          onPress={onBack}
          accessibilityLabel={t('common.backA11y')}
          className="items-center justify-center rounded-full bg-sand active:scale-95"
          style={{ width: 34, height: 34 }}>
          <Ionicons name="chevron-back" size={17} color={colors.forest} />
        </Pressable>
        <Text className="font-serif text-[20px] text-ink">{t('importFlow.fromSocial')}</Text>
      </View>

      <View style={{ gap: 11 }}>
        {rows.map((row) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={
              row.enabled ? row.label : t('importFlow.platformSoonA11y', { platform: row.label })
            }
            accessibilityState={{ disabled: !row.enabled }}
            disabled={!row.enabled}
            onPress={onPickPlatform}
            className={`flex-row items-center rounded-2xl bg-white ${
              row.enabled ? 'active:scale-[0.98]' : 'opacity-45'
            }`}
            style={[{ paddingVertical: 15, paddingHorizontal: 16, gap: 13 }, ROW_SHADOW]}>
            {row.square}
            <Text className="flex-1 font-sans-semibold text-[15px] text-ink">{row.label}</Text>
            {row.enabled ? (
              <Ionicons name="chevron-forward" size={17} color="#C7CFC9" />
            ) : (
              <View className="rounded-full bg-sand px-2.5 py-1">
                <Text className="font-sans-semibold text-[10.5px] text-muted">
                  {t('importFlow.comingSoon')}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
