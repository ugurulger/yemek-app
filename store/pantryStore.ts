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
  /**
   * Temel Malzemeler bloğunun son değişiklik zamanı (epoch ms) — her toggle/
   * ekleme/silmede güncellenir, persist ile kalıcıdır. Mutfağım ekranında
   * "Bugün/Dün/tarih" olarak gösterilir (İş 2). Hiç değişiklik yapılmamışsa null.
   */
  lastUpdatedAt: number | null;
  toggleItem: (id: string) => void;
  /** Aynı ad (normalize, iki dilli alanlar dahil) zaten varsa eklemez, pasifse aktifleştirir. */
  addItems: (items: Omit<PantryItem, 'id'>[]) => void;
  removeItem: (id: string) => void;
  /**
   * Eksik dil karşılıklarını arka plan çevirisiyle tamamlar (kullanıcı
   * eklemeleri için; varsayılan malzemeler i18n anahtarıyla çevrilir) —
   * bkz. src/i18n/inventoryI18n.ts backfillPantryTranslations.
   */
  applyNameTranslations: (entries: { id: string; nameTr?: string; nameEn?: string }[]) => void;
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('tr-TR');
}

/** Ürünün bilinen tüm ad varyantları (kanonik + iki dilli) — mükerrer eklemeyi
 * dil fark etmeksizin yakalamak için ("Ekmek" varken "Bread" eklenmesin). */
function nameVariants(item: Pick<PantryItem, 'name' | 'nameTr' | 'nameEn'>): string[] {
  return [item.name, item.nameTr, item.nameEn]
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    .map(normalizeName);
}

function seedDefaults(): PantryItem[] {
  return DEFAULT_PANTRY_ITEMS.map((item, index) => ({ ...item, id: `pantry-${index}` }));
}

export const usePantryStore = create<PantryState>()(
  persist(
    (set) => ({
      items: seedDefaults(),
      lastUpdatedAt: null,
      toggleItem: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, active: !item.active } : item
          ),
          lastUpdatedAt: Date.now(),
        })),
      addItems: (newItems) =>
        set((state) => {
          const items = [...state.items];
          for (const newItem of newItems) {
            const newVariants = nameVariants(newItem);
            const existing = items.findIndex((item) =>
              nameVariants(item).some((variant) => newVariants.includes(variant))
            );
            if (existing >= 0) {
              // Aktifleştir + yeni gelen dil karşılıklarını (varsa) tamamla —
              // mevcut dolu alan EZİLMEZ.
              items[existing] = {
                ...items[existing],
                active: true,
                nameTr: items[existing].nameTr ?? newItem.nameTr,
                nameEn: items[existing].nameEn ?? newItem.nameEn,
              };
            } else {
              items.push({ ...newItem, id: `pantry-${Date.now()}-${items.length}` });
            }
          }
          return { items, lastUpdatedAt: Date.now() };
        }),
      applyNameTranslations: (entries) =>
        set((state) => ({
          // lastUpdatedAt BİLİNÇLİ güncellenmez — arka plan çevirisi kullanıcı
          // eylemi değildir, "son güncelleme" göstergesini oynatmamalı.
          items: state.items.map((item) => {
            const entry = entries.find((candidate) => candidate.id === item.id);
            if (!entry) return item;
            return {
              ...item,
              nameTr: item.nameTr ?? entry.nameTr,
              nameEn: item.nameEn ?? entry.nameEn,
            };
          }),
        })),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
          lastUpdatedAt: Date.now(),
        })),
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
