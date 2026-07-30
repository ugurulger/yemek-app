import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Onboarding store'u — yalnızca İLK açılışta gösterilen 4 ekranlık tanıtım
 * akışının "görüldü" bayrağını tutar (app/onboarding.tsx). Bayrak persist'tir;
 * skip dahil akıştan her çıkış bayrağı kalıcı olarak set eder, onboarding bir
 * daha gösterilmez. Yönlendirme kararı app/_layout.tsx'te verilir (hidrasyon
 * beklenir ki her açılışta yanlışlıkla onboarding'e düşülmesin).
 */
interface OnboardingState {
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: 'yemek-app-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
