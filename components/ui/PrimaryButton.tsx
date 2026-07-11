import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  /** Eski API — true ise size='small' ile aynı. */
  compact?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'light';
  /**
   * Birebir referans boyları (Mutfagim.dc.html):
   * - 'cta':   600 15px, padding 16, radius 18, gölge 0 12px 26px -10px rgba(31,74,61,.6)
   * - 'small': 600 12px, padding 10×12, radius 14, gölge 0 8px 16px -10px rgba(31,74,61,.6)
   * - 'pill':  600 11.5px, padding 8×13, radius 20 (kiler "Asistanla ekle")
   * light varyantı: beyaz zemin + forest metin, ÇERÇEVE YOK,
   * gölge 0 2px 10px -4px rgba(31,74,61,.16).
   */
  size?: 'cta' | 'small' | 'pill';
}

// CSS gölgeleri NEGATİF spread içerir (örn. 0 12px 26px -10px) — spread
// gölgeyi sıkılaştırır. RN'de spread olmadığından opaklık/yarıçap birebir
// taşınınca koca koyu lekeler oluşuyordu; buradaki değerler CSS'in GÖRSEL
// karşılığına kalibre edildi (daha dar yarıçap + düşük opaklık).
const PRIMARY_SHADOW_CTA = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
  elevation: 5,
} as const;

const PRIMARY_SHADOW_SMALL = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 3,
} as const;

const LIGHT_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.14,
  shadowRadius: 4,
  elevation: 2,
} as const;

/** Birincil buton — değerler birebir referans kaynağından. */
export function PrimaryButton({
  label,
  onPress,
  icon,
  compact = false,
  disabled = false,
  variant = 'primary',
  size,
}: PrimaryButtonProps) {
  const resolvedSize = size ?? (compact ? 'small' : 'cta');
  const isLight = variant === 'light';

  const sizeClasses =
    resolvedSize === 'cta'
      ? 'rounded-[18px] px-4 py-4'
      : resolvedSize === 'small'
        ? 'rounded-[14px] px-3 py-2.5'
        : 'rounded-[20px] px-[13px] py-2';
  const textClasses =
    resolvedSize === 'cta' ? 'text-[15px]' : resolvedSize === 'small' ? 'text-[12px]' : 'text-[11.5px]';
  // Referansta 'pill' butonu (kiler "Asistanla ekle", satır 102) GÖLGESİZDİR.
  const shadow = isLight
    ? LIGHT_SHADOW
    : resolvedSize === 'cta'
      ? PRIMARY_SHADOW_CTA
      : resolvedSize === 'small'
        ? PRIMARY_SHADOW_SMALL
        : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-center active:scale-95 ${
        isLight ? 'bg-white' : 'bg-forest'
      } ${sizeClasses} ${disabled ? 'opacity-50' : ''}`}
      style={shadow}>
      {icon ? <View className="mr-2">{icon}</View> : null}
      <Text className={`font-sans-semibold ${isLight ? 'text-forest' : 'text-white'} ${textClasses}`}>
        {label}
      </Text>
    </Pressable>
  );
}
