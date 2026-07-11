import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui';
import { PLAN_DAYS, usePlanStore, type PlanDay } from '@/store/planStore';
import type { Recipe } from '@/types/recipe';

export interface PlanDayPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  recipe: Recipe;
  /** Detay ekranındaki güncel kişi sayısı — plan kaydına aynen yazılır. */
  servings: number;
}

/** Gün satırı gölgesi — referans: 0 2px 8px -4px rgba(31,74,61,.12). */
const ROW_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 4,
  elevation: 2,
} as const;

/**
 * "Hangi güne?" sheet'i — BİREBİR referans (PLAN DAY PICKER SHEET):
 * serif 22 forest başlık + muted alt metin; 7 beyaz gün satırı (radius 15,
 * padding 14/16) solda gün adı, sağda "{N} öğün planlı" sayacı. Güne
 * dokunmak tarifi o günün planına ekler ve sheet'i kapatır.
 */
export default function PlanDayPickerSheet({
  visible,
  onClose,
  recipe,
  servings,
}: PlanDayPickerSheetProps) {
  const plan = usePlanStore((state) => state.plan);
  const addToPlan = usePlanStore((state) => state.addToPlan);

  const handleSelectDay = (day: PlanDay) => {
    addToPlan(day, {
      recipeId: recipe.id,
      name: recipe.name,
      kcal: recipe.kcal,
      emoji: recipe.emoji,
      meal: 'Akşam',
      servings,
    });
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mb-1 font-serif text-[22px] text-forest">Hangi güne?</Text>
      <Text className="mb-[18px] font-sans text-[13px] text-muted">
        Tarifi haftalık planına ekle
      </Text>

      <View className="gap-[9px]">
        {PLAN_DAYS.map((day) => (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`Tarifi ${day} gününe ekle`}
            onPress={() => handleSelectDay(day)}
            className="flex-row items-center justify-between rounded-[15px] bg-white px-4 py-3.5 active:scale-[0.98]"
            style={ROW_SHADOW}>
            <Text className="font-sans-semibold text-[14px] text-ink">{day}</Text>
            <Text className="font-sans-medium text-[11px] text-muted">
              {plan[day].length} öğün planlı
            </Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
