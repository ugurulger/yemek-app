import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import PlanDayRow from '@/components/plan/PlanDayRow';
import { useCartStore } from '@/store/cartStore';
import { countPlannedMeals, PLAN_DAYS, usePlanStore, type PlanDay } from '@/store/planStore';

/**
 * Planlama — haftalık yemek ajandası (spec: Mutfagim.dc.html SCREEN 6).
 * Başlıkta bu haftaki toplam planlı öğün sayısı; altında 7 günün her biri
 * bir satır — boş günler kesikli "Plan boş" kutusuyla, dolu günler öğün
 * kartlarıyla. Hiç öğün yokken ayrı bir boş durum ekranı YOK (referansla
 * aynı: 7 gün de "Plan boş" kutusuyla görünür).
 */
export default function PlanScreen() {
  const router = useRouter();
  const plan = usePlanStore((state) => state.plan);
  const removeFromPlan = usePlanStore((state) => state.removeFromPlan);

  const totalMeals = countPlannedMeals(plan);

  /**
   * Plan → sepet otomasyonu: tarif plandan çıkarılınca, BAŞKA planlı girdisi
   * kalmadıysa yalnızca o tarifin sepet katkısı düşer (sepet kayıtları tarif
   * bazlı olduğu için diğer tariflerin ortak malzemeleri sepette kalır).
   */
  const handleRemoveEntry = (day: PlanDay, index: number) => {
    const entry = plan[day][index];
    removeFromPlan(day, index);
    if (!entry) return;
    const stillPlanned = PLAN_DAYS.some((d) =>
      plan[d].some(
        (other, i) => other.recipeId === entry.recipeId && !(d === day && i === index)
      )
    );
    if (!stillPlanned) {
      useCartStore.getState().removeRecipe(entry.name);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        // Referansın 120px alt boşluğu overlay bottom-nav içindi; buradaki
        // tab bar overlay değil, market ekranıyla tutarlı boşluk yeterli.
        contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Başlık bloğu — referans 468-471: eyebrow 400 13px muted
            (letterSpacing .3) + h1 500 34px Newsreader forest. */}
        <View className="px-5 pt-2">
          <Text className="font-sans text-[13px] tracking-[0.3px] text-muted">
            Bu hafta · {totalMeals} öğün planlı
          </Text>
          <Text className="mt-[2px] font-serif text-[34px] text-forest">Planlama</Text>
        </View>

        {/* Gün listesi — dikey gap 16, mt 22. */}
        <View className="mt-[22px] gap-4 px-5">
          {PLAN_DAYS.map((day) => (
            <PlanDayRow
              key={day}
              day={day}
              entries={plan[day]}
              onPressEntry={(entry) => router.push(`/recipe/${entry.recipeId}`)}
              onRemoveEntry={(index) => handleRemoveEntry(day, index)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
