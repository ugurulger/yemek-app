import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { InventoryItem } from '@/types/inventory';

interface InventoryState {
  items: InventoryItem[];
  /**
   * Buzdolabım bloğunun son değişiklik zamanı (epoch ms) — her ekleme/silme/
   * düzenlemede güncellenir, persist ile kalıcıdır. Mutfağım ekranında
   * "Bugün/Dün/tarih" olarak gösterilir (İş 2). Hiç değişiklik yapılmamışsa null.
   */
  lastUpdatedAt: number | null;
  /**
   * EKLEME modu — fiş/fotoğraf akışı için: yeni ürünler mevcut envanterle
   * birleştirilir (aynı ad+birim varsa miktarlar toplanır).
   */
  addItems: (newItems: InventoryItem[]) => void;
  /**
   * TAM TARAMA modu — video analizi için: mevcut envanter yeni listeyle
   * DEĞİŞTİRİLİR (miktar toplama yok). Video zaten buzdolabının o anki tam
   * halini gösterdiğinden birikimli ekleme miktarları katlıyordu (aynı video
   * ikinci kez analiz edilince 2 süt → 4 süt). Kullanıcının elle
   * eklediği/düzenlediği kayıtlar da yenilenir — bilinçli olarak basit
   * tutuldu, birleştirme mantığı YOK. Çağıran taraf değiştirmeden önce
   * kullanıcıdan onay alır (bkz. app/(tabs)/index.tsx — Alert).
   */
  replaceItems: (newItems: InventoryItem[]) => void;
  incrementQty: (id: string) => void;
  decrementQty: (id: string) => void;
  removeItem: (id: string) => void;
  confirmItem: (id: string) => void;
  /**
   * Dil değişimi backfill'i (bkz. src/i18n/inventoryI18n.ts): eksik nameTr/
   * nameEn karşılıklarını toplu yazar. İçerik değişimi sayılmaz —
   * lastUpdatedAt GÜNCELLENMEZ (yalnızca gösterim adı zenginleşir).
   */
  applyNameTranslations: (
    updates: Array<{ id: string; nameTr?: string; nameEn?: string }>
  ) => void;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      items: [],
      lastUpdatedAt: null,
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

          return { items, lastUpdatedAt: Date.now() };
        }),
      replaceItems: (newItems) => set({ items: newItems, lastUpdatedAt: Date.now() }),
      incrementQty: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, qty: item.qty + 1 } : item
          ),
          lastUpdatedAt: Date.now(),
        })),
      decrementQty: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id && item.qty > 1 ? { ...item, qty: item.qty - 1 } : item
          ),
          lastUpdatedAt: Date.now(),
        })),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
          lastUpdatedAt: Date.now(),
        })),
      confirmItem: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, confidence: 100 } : item
          ),
          lastUpdatedAt: Date.now(),
        })),
      applyNameTranslations: (updates) =>
        set((state) => {
          const byId = new Map(updates.map((update) => [update.id, update]));
          return {
            items: state.items.map((item) => {
              const update = byId.get(item.id);
              if (!update) {
                return item;
              }
              return {
                ...item,
                ...(update.nameTr ? { nameTr: update.nameTr } : {}),
                ...(update.nameEn ? { nameEn: update.nameEn } : {}),
              };
            }),
          };
        }),
    }),
    {
      name: 'yemek-app-inventory',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      /**
       * v1 (İş 3a): iki dilli ad alanları öncesinden kalan kayıtlarda `name`
       * Türkçe kanonik addı — nameTr olarak kopyalanır (nameEn açılış
       * backfill'iyle LLM'den tamamlanır, bkz. app/_layout.tsx). İki alandan
       * HERHANGİ biri doluysa kayıt zaten iki dilli akıştan geçmiştir,
       * dokunulmaz (EN taramadan gelen kayda yanlış nameTr yazmamak için).
       */
      migrate: (persisted, version) => {
        const state = persisted as { items?: InventoryItem[]; lastUpdatedAt?: number | null };
        if (version < 1 && Array.isArray(state.items)) {
          state.items = state.items.map((item) =>
            !item.nameTr && !item.nameEn ? { ...item, nameTr: item.name } : item
          );
        }
        return state;
      },
    }
  )
);
