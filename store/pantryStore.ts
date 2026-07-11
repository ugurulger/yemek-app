import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_PANTRY_ITEMS, type PantryItem } from '@/types/pantry';

/**
 * Temel Malzemeler (kiler) store'u — spec §2. Varsayılan 20 malzemeyle
 * başlar; kullanıcı chip'e dokunarak aktif/pasif yapar, "Asistanla ekle" ile
 * yenilerini ekleyebilir. Tarif üretimi SADECE aktif olanları "evde var" alır
 * (bkz. services/contracts.ts — generateRecipes).
 */
interface PantryState {
  items: PantryItem[];
  toggleItem: (id: string) => void;
  /** Aynı ad (normalize) zaten varsa eklemez, pasifse aktifleştirir. */
  addItems: (items: Omit<PantryItem, 'id'>[]) => void;
  removeItem: (id: string) => void;
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('tr-TR');
}

function seedDefaults(): PantryItem[] {
  return DEFAULT_PANTRY_ITEMS.map((item, index) => ({ ...item, id: `pantry-${index}` }));
}

export const usePantryStore = create<PantryState>()(
  persist(
    (set) => ({
      items: seedDefaults(),
      toggleItem: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, active: !item.active } : item
          ),
        })),
      addItems: (newItems) =>
        set((state) => {
          const items = [...state.items];
          for (const newItem of newItems) {
            const existing = items.findIndex(
              (item) => normalizeName(item.name) === normalizeName(newItem.name)
            );
            if (existing >= 0) {
              items[existing] = { ...items[existing], active: true };
            } else {
              items.push({ ...newItem, id: `pantry-${Date.now()}-${items.length}` });
            }
          }
          return { items };
        }),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
    }),
    {
      name: 'yemek-app-pantry',
      storage: createJSONStorage(() => AsyncStorage),
      // v1: "Toz Kırmızı Biber" → "Toz K. Biber" (referans verisiyle birebir;
      // uzun ad dar kiler kartında taşıyordu). Daha önce persist edilmiş
      // cihazlarda da ad güncellensin diye migrate ile yeniden adlandırılır.
      version: 1,
      migrate: (persisted) => {
        const state = persisted as { items?: PantryItem[] } | undefined;
        if (!state?.items) return state as never;
        return {
          ...state,
          items: state.items.map((item) =>
            item.name === 'Toz Kırmızı Biber' ? { ...item, name: 'Toz K. Biber' } : item
          ),
        } as never;
      },
    }
  )
);
