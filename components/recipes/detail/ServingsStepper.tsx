import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/lib/theme';

export interface ServingsStepperProps {
  servings: number;
  onChange: (next: number) => void;
}

/** Referans: box-shadow 0 1px 5px -2px rgba(31,74,61,.16). */
const STEPPER_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.16,
  shadowRadius: 2.5,
  elevation: 2,
} as const;

/**
 * Kişi sayısı stepper'ı — BİREBİR referans (SCREEN 3): beyaz pill radius 22,
 * padding 4px 5px, gap 6; − butonu 30×30 daire bg #EFF3EC ikon forest;
 * etiket 600 13px #23302B minWidth 56 ortalı "{N} kişilik"; + butonu 30×30
 * daire bg forest ikon beyaz.
 */
export default function ServingsStepper({ servings, onChange }: ServingsStepperProps) {
  const canDecrease = servings > 1;

  return (
    <View
      className="flex-row items-center gap-1.5 rounded-[22px] bg-white px-[5px] py-1"
      style={STEPPER_SHADOW}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kişi sayısını azalt"
        disabled={!canDecrease}
        onPress={() => onChange(servings - 1)}
        className={`h-[30px] w-[30px] items-center justify-center rounded-full bg-pillbg active:scale-95 ${
          canDecrease ? '' : 'opacity-40'
        }`}>
        <Ionicons name="remove" size={15} color={colors.forest} />
      </Pressable>
      <Text
        className="text-center font-sans-semibold text-[13px] text-ink"
        style={{ minWidth: 56 }}>
        {servings} kişilik
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kişi sayısını artır"
        onPress={() => onChange(servings + 1)}
        className="h-[30px] w-[30px] items-center justify-center rounded-full bg-forest active:scale-95">
        <Ionicons name="add" size={15} color="white" />
      </Pressable>
    </View>
  );
}
