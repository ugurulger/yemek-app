import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Haftalık ajanda gün anahtarları — referans SCREEN 6 sırasıyla. */
export const PLAN_DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;
export type PlanDay = (typeof PLAN_DAYS)[number];

export const PLAN_DAY_LABELS: Record<PlanDay, string> = {
  Pzt: 'Pazartesi',
  Sal: 'Salı',
  Çar: 'Çarşamba',
  Per: 'Perşembe',
  Cum: 'Cuma',
  Cmt: 'Cumartesi',
  Paz: 'Pazar',
};

export type PlanMeal = 'Kahvaltı' | 'Öğle' | 'Akşam';

export interface PlanEntry {
  recipeId: string;
  /**
   * Denormalize kopya: üretilmiş tarifler envanter değişince yeniden
   * üretilip kaybolabilir — plan kartı tarif objesi çözülemese de adını,
   * kalorisini ve emojisini gösterebilmeli.
   */
  name: string;
  kcal: number;
  emoji: string;
  meal: PlanMeal;
  /** Plana eklenirken detay ekranında ayarlı olan kişi sayısı. */
  servings: number;
}

type PlanRecord = Record<PlanDay, PlanEntry[]>;

const EMPTY_PLAN: PlanRecord = {
  Pzt: [],
  Sal: [],
  Çar: [],
  Per: [],
  Cum: [],
  Cmt: [],
  Paz: [],
};

interface PlanState {
  plan: PlanRecord;
  addToPlan: (day: PlanDay, entry: PlanEntry) => void;
  removeFromPlan: (day: PlanDay, index: number) => void;
  /** Bir tarif silindiğinde/temizlikte plandan da düşürmek için. */
  removeRecipeEverywhere: (recipeId: string) => void;
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      plan: EMPTY_PLAN,
      addToPlan: (day, entry) =>
        set((state) => ({ plan: { ...state.plan, [day]: [...state.plan[day], entry] } })),
      removeFromPlan: (day, index) =>
        set((state) => ({
          plan: { ...state.plan, [day]: state.plan[day].filter((_, i) => i !== index) },
        })),
      removeRecipeEverywhere: (recipeId) =>
        set((state) => {
          const plan = { ...state.plan };
          for (const day of PLAN_DAYS) {
            plan[day] = plan[day].filter((entry) => entry.recipeId !== recipeId);
          }
          return { plan };
        }),
    }),
    {
      name: 'yemek-app-plan',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);

/** Bu hafta planlı toplam öğün sayısı (başlık alt metni). */
export function countPlannedMeals(plan: PlanRecord): number {
  return PLAN_DAYS.reduce((total, day) => total + plan[day].length, 0);
}
