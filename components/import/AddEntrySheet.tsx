import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui';
import { colors } from '@/lib/theme';

export interface AddEntrySheetProps {
  visible: boolean;
  onClose: () => void;
  /** "Add a Recipe" → Tarif Ekle menüsü (sosyal/web/fotoğraf). */
  onAddRecipe: () => void;
  /** "Add a Cookbook" → defter oluşturma sheet'i. */
  onAddCookbook: () => void;
}

/** Satır gölgesi — SocialPlatformSheet ile aynı: 0 2px 8px -4px rgba(31,74,61,.12). */
const ROW_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 4,
  elevation: 2,
} as const;

/**
 * "+" akışının GİRİŞ sheet'i — referans design/Tarif_ekle/IMG_8473.PNG:
 * iki satır — "Add a Recipe / Import from anywhere" ve "Add a Cookbook".
 * Başlıklar referansla aynı İngilizce bırakılır (kullanıcı kararı); görsel
 * dil bizim sheet iskeletimize (BottomSheet + beyaz satırlar) uyarlanır.
 */
export function AddEntrySheet({ visible, onClose, onAddRecipe, onAddCookbook }: AddEntrySheetProps) {
  const rows = [
    {
      key: 'recipe',
      icon: 'newspaper-outline' as const,
      label: 'Add a Recipe',
      sub: 'Import from anywhere',
      onPress: onAddRecipe,
    },
    {
      key: 'cookbook',
      icon: 'bookmark-outline' as const,
      label: 'Add a Cookbook',
      sub: 'Tariflerin için yeni bir defter',
      onPress: onAddCookbook,
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 11 }}>
        {rows.map((row) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            onPress={row.onPress}
            className="flex-row items-center rounded-2xl bg-white active:scale-[0.98]"
            style={[{ paddingVertical: 15, paddingHorizontal: 16, gap: 13 }, ROW_SHADOW]}>
            <View
              className="items-center justify-center"
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                backgroundColor: colors.softGreenBg,
              }}>
              <Ionicons name={row.icon} size={22} color={colors.softGreenText} />
            </View>
            <View className="flex-1">
              <Text className="font-sans-semibold text-[15px] text-ink">{row.label}</Text>
              <Text className="mt-0.5 font-sans text-[12px] text-muted">{row.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#C7CFC9" />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
