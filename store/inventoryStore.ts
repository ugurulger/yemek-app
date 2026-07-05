import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { InventoryItem } from '@/types/inventory';

interface InventoryState {
  items: InventoryItem[];
  addItems: (newItems: InventoryItem[]) => void;
  incrementQty: (id: string) => void;
  decrementQty: (id: string) => void;
  removeItem: (id: string) => void;
  confirmItem: (id: string) => void;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      items: [],
      addItems: (newItems) =>
        set((state) => {
          const items = [...state.items];

          for (const newItem of newItems) {
            const existingIndex = items.findIndex(
              (item) =>
                normalizeName(item.name) === normalizeName(newItem.name) &&
                item.unit === newItem.unit
            );

            if (existingIndex >= 0) {
              items[existingIndex] = {
                ...items[existingIndex],
                qty: items[existingIndex].qty + newItem.qty,
                confidence: newItem.confidence ?? items[existingIndex].confidence,
              };
            } else {
              items.push(newItem);
            }
          }

          return { items };
        }),
      incrementQty: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, qty: item.qty + 1 } : item
          ),
        })),
      decrementQty: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id && item.qty > 1 ? { ...item, qty: item.qty - 1 } : item
          ),
        })),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      confirmItem: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, confidence: 100 } : item
          ),
        })),
    }),
    {
      name: 'yemek-app-inventory',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
