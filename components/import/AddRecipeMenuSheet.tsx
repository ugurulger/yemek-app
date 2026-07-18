import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from '@/components/ui';
import { colors, cardShadow } from '@/lib/theme';

import { PLATFORM_COLORS, PlatformSquare } from './PlatformSquare';

export interface AddRecipeMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 'Sosyal medyadan aktar' → platform seçim sheet'i. */
  onSocial: () => void;
  /** 'Web sitesinden' → tarayıcı taklidi. */
  onWeb: () => void;
  /** 'Fotoğraftan' → kamera (mode=recipe). */
  onPhoto: () => void;
}

/**
 * "Tarif Ekle" menü sheet'i — referans ADD-RECIPE MENU SHEET (Mutfagim.dc.html
 * 534-571) birebir: ortalı serif başlık, büyük sosyal medya kartı (üst üste
 * bindirilmiş 3 platform karesi) ve altında 2'li grid (Web / Fotoğraf).
 */
export function AddRecipeMenuSheet({
  visible,
  onClose,
  onSocial,
  onWeb,
  onPhoto,
}: AddRecipeMenuSheetProps) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mb-[3px] text-center font-serif text-[22px] text-forest">
        {t('importFlow.menuTitle')}
      </Text>
      <Text className="mb-[18px] text-center font-sans text-[12.5px] text-muted">
        {t('importFlow.menuSubtitle')}
      </Text>

      {/* Büyük buton: Sosyal medyadan aktar — referans 542-553. */}
      <Pressable
        onPress={onSocial}
        className="mb-3 w-full flex-row items-center gap-3.5 rounded-[20px] bg-white p-4 active:scale-[0.98]"
        style={cardShadow}>
        {/* Üst üste bindirilmiş 3 platform karesi — -10px bindirme + 2px krem border. */}
        <View className="flex-row">
          <PlatformSquare color={PLATFORM_COLORS.instagram} />
          <PlatformSquare
            color={PLATFORM_COLORS.tiktok}
            style={{ marginLeft: -10, borderWidth: 2, borderColor: colors.cream }}
          />
          <PlatformSquare
            color={PLATFORM_COLORS.facebook}
            style={{ marginLeft: -10, borderWidth: 2, borderColor: colors.cream }}
          />
        </View>
        <View className="flex-1">
          <Text className="font-sans-semibold text-[15px] text-ink">{t('importFlow.fromSocial')}</Text>
          <Text className="mt-0.5 font-sans text-[12px] text-muted">
            Instagram · TikTok · Facebook
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#C7CFC9" />
      </Pressable>

      {/* 2'li grid: Web sitesinden / Fotoğraftan — referans 554-569. */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={onWeb}
          className="flex-1 rounded-[20px] bg-white p-4 active:scale-[0.98]"
          style={cardShadow}>
          <View
            className="mb-2.5 items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.softGreenBg }}>
            <Ionicons name="link-outline" size={22} color={colors.softGreenText} />
          </View>
          <Text className="font-sans-semibold text-[14px] text-ink">{t('importFlow.fromWeb')}</Text>
          <Text className="mt-0.5 font-sans text-[11px] text-muted">{t('importFlow.fromWebHint')}</Text>
        </Pressable>
        <Pressable
          onPress={onPhoto}
          className="flex-1 rounded-[20px] bg-white p-4 active:scale-[0.98]"
          style={cardShadow}>
          <View
            className="mb-2.5 items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: '#F4ECCB' }}>
            <Ionicons name="image-outline" size={22} color="#9A7B1F" />
          </View>
          <Text className="font-sans-semibold text-[14px] text-ink">{t('importFlow.fromPhoto')}</Text>
          <Text className="mt-0.5 font-sans text-[11px] text-muted">{t('importFlow.fromPhotoHint')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
