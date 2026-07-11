import { Pressable, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../lib/theme';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: 'normal' | 'compact';
  /** Seçiliyken solda beyaz ✓ ikonu göster (referans: asistan parsed chip'leri). */
  showCheck?: boolean;
}

/**
 * Seçilebilir pill chip — BİREBİR referans: design/reference/Mutfagim.dc.html
 * `chipStyle` (normal) ve `chipStyleSm` (compact).
 *
 * normal  sel:  bg#1F4A3D beyaz 600 12px, padding 8×12, radius 20, gap 5
 * normal  unsel: border 1px rgba(31,74,61,.22), #8A9088 500 12px
 * compact sel:  bg#1F4A3D beyaz 600 11px, padding 5×9, radius 15
 * compact unsel: border 1px rgba(31,74,61,.2), #96A199 500 11px
 */
export function Chip({ label, selected, onPress, size = 'normal', showCheck = false }: ChipProps) {
  const isCompact = size === 'compact';

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center active:scale-95 ${selected ? 'bg-forest' : 'bg-white border'} ${
        isCompact ? 'rounded-[15px] px-[9px] py-[5px]' : 'rounded-[20px] px-3 py-2'
      }`}
      // flexShrink: dar konteynerde (kiler kartı yarım sütun) chip kartın
      // dışına TAŞMAK yerine daralır; metin tek satırda üç noktayla kısalır.
      style={[
        { flexShrink: 1 },
        selected ? null : { borderColor: isCompact ? colors.chipBorderSm : colors.chipBorder },
      ]}>
      {selected && showCheck ? (
        <View className="mr-[5px]">
          <Ionicons name="checkmark" size={13} color="#fff" />
        </View>
      ) : null}
      <Text
        numberOfLines={1}
        className={`${selected ? 'font-sans-semibold text-white' : 'font-sans-medium'} ${
          isCompact ? 'text-[11px]' : 'text-[12px]'
        }`}
        style={[{ flexShrink: 1 }, selected ? null : { color: isCompact ? colors.muted2 : colors.muted }]}>
        {label}
      </Text>
    </Pressable>
  );
}
