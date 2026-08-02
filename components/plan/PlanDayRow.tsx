import type { View as ViewType } from 'react-native';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';

import DraggablePlanEntry from '@/components/plan/DraggablePlanEntry';
import type { PlanDragController, PlanDragSource } from '@/components/plan/planDrag';
import type { PlanDay, PlanEntry } from '@/store/planStore';

interface PlanDayRowProps {
  day: PlanDay;
  /** PLAN_DAYS içindeki sıra — sürükleme gün vurgusu bu index'le eşleşir. */
  dayIndex: number;
  entries: PlanEntry[];
  onPressEntry: (entry: PlanEntry) => void;
  onRemoveEntry: (index: number) => void;
  drag: PlanDragController;
  dragSource: PlanDragSource | null;
  registerDayRef: (dayIndex: number) => (ref: ViewType | null) => void;
  registerCardRef: (day: PlanDay, index: number) => (ref: ViewType | null) => void;
}

/**
 * Haftalık ajanda gün satırı — referans (Mutfagim.dc.html SCREEN 6): solda
 * 40px sabit sütun (gün kısaltması + nokta), sağda boş günde kesikli "Plan
 * boş" kutusu, dolu günde öğün kartları. Dikey doluluk işiyle satır artık
 * ESNEK: üst kapsayıcı flexGrow ağırlığı verir, boş kutu ve kartlar satır
 * yüksekliğini doldurur (flex-1) — alt boşluk kalmaz.
 *
 * Sürükleme: kartlar DraggablePlanEntry ile sarılır; bu satır bir sürükleme
 * HEDEFİ olduğunda sağ sütun yumuşak forest tintiyle vurgulanır
 * (hoverDayIndex shared value — render'sız, worklet'ten).
 */
export default function PlanDayRow({
  day,
  dayIndex,
  entries,
  onPressEntry,
  onRemoveEntry,
  drag,
  dragSource,
  registerDayRef,
  registerCardRef,
}: PlanDayRowProps) {
  const { t } = useTranslation();

  const hoverStyle = useAnimatedStyle(() => ({
    backgroundColor:
      drag.hoverDayIndex.value === dayIndex ? 'rgba(31,74,61,0.07)' : 'transparent',
  }));

  return (
    <View ref={registerDayRef(dayIndex)} collapsable={false} className="flex-1 flex-row gap-[14px]">
      {/* Sol sütun — gün kısaltması + nokta. */}
      <View className="w-10 flex-none items-center pt-[2px]">
        <Text className="font-sans-semibold text-[12px] uppercase tracking-[0.5px] text-forest">
          {t(`data.day.${day}`)}
        </Text>
        <View className="mt-2 h-2 w-2 rounded-full bg-[#DDE4DE]" />
      </View>

      {/* Animated.View'a className güvenilmez (overlay dersi) — layout düz style. */}
      <Animated.View
        style={[
          { flex: 1, minWidth: 0, borderRadius: 18, margin: -3, padding: 3 },
          hoverStyle,
        ]}>
        {entries.length === 0 ? (
          /* Boş gün — 1.5px kesikli çerçeve rgba(31,74,61,.2), radius 16. */
          <View
            className="flex-1 flex-row items-center justify-center gap-[7px] rounded-2xl p-[14px]"
            style={{
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: 'rgba(31,74,61,0.2)',
              minHeight: 52,
            }}>
            <Ionicons name="add" size={15} color="#A2ABA4" />
            <Text className="font-sans-medium text-[12.5px] text-[#A2ABA4]">{t('plan.emptyDay')}</Text>
          </View>
        ) : (
          <View className="flex-1 gap-[9px]">
            {entries.map((entry, index) => (
              <DraggablePlanEntry
                // Aynı tarif aynı güne birden fazla öğün için eklenebilir —
                // recipeId tek başına benzersiz değil, index'le birleştirilir.
                key={`${entry.recipeId}-${index}`}
                day={day}
                index={index}
                entry={entry}
                drag={drag}
                isDragSource={dragSource?.day === day && dragSource.index === index}
                cardRef={registerCardRef(day, index)}
                onPress={() => onPressEntry(entry)}
                onRemove={() => onRemoveEntry(index)}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}
