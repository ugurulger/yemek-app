import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';

import PlanEntryCard from '@/components/plan/PlanEntryCard';
import type { PlanDay, PlanEntry } from '@/store/planStore';

interface PlanDayRowProps {
  day: PlanDay;
  entries: PlanEntry[];
  onPressEntry: (entry: PlanEntry) => void;
  onRemoveEntry: (index: number) => void;
}

/**
 * Haftalık ajanda gün satırı — birebir referans (Mutfagim.dc.html SCREEN 6):
 * solda 40px sabit sütun (gün kısaltması 600 12px forest uppercase + altında
 * 8px nokta), sağda gün BOŞSA kesikli çerçeveli "Plan boş" kutusu, doluysa
 * dikey gap 9 ile öğün kartları.
 */
export default function PlanDayRow({ day, entries, onPressEntry, onRemoveEntry }: PlanDayRowProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-[14px]">
      {/* Sol sütun — gün kısaltması + nokta. */}
      <View className="w-10 flex-none items-center pt-[2px]">
        <Text className="font-sans-semibold text-[12px] uppercase tracking-[0.5px] text-forest">
          {t(`data.day.${day}`)}
        </Text>
        <View className="mt-2 h-2 w-2 rounded-full bg-[#DDE4DE]" />
      </View>

      <View className="min-w-0 flex-1">
        {entries.length === 0 ? (
          /* Boş gün — 1.5px kesikli çerçeve rgba(31,74,61,.2), radius 16. */
          <View
            className="flex-row items-center justify-center gap-[7px] rounded-2xl p-[14px]"
            style={{
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: 'rgba(31,74,61,0.2)',
            }}>
            <Ionicons name="add" size={15} color="#A2ABA4" />
            <Text className="font-sans-medium text-[12.5px] text-[#A2ABA4]">{t('plan.emptyDay')}</Text>
          </View>
        ) : (
          <View className="gap-[9px]">
            {entries.map((entry, index) => (
              <PlanEntryCard
                // Aynı tarif aynı güne birden fazla öğün için eklenebilir —
                // recipeId tek başına benzersiz değil, index'le birleştirilir.
                key={`${entry.recipeId}-${index}`}
                entry={entry}
                onPress={() => onPressEntry(entry)}
                onRemove={() => onRemoveEntry(index)}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
