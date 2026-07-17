/**
 * Market ekranının tek eşleştirme hook'u: sepet satırlarını (CartItemView)
 * izler, birleşik anahtar seti değişince motoru otomatik koşturur
 * (kullanıcı kararı: otomatik tetikleme; recipeStore'un fingerprint kalıbı),
 * satır bazında eşleşme görünümü ve mağaza toplamlarını üretir.
 */

import { useEffect, useMemo } from 'react';

import { LOW_CONFIDENCE_THRESHOLD } from '@/services/matching/fuzzy';
import type { IngredientMatch } from '@/services/matching/types';
import { STORE_IDS, type StoreId } from '@/services/stores/types';
import { useMarketMatchStore, type MarketMatchStatus } from '@/store/marketMatchStore';
import type { CartItemView } from '@/types/cart';

export interface CartMatchView {
  match: IngredientMatch | undefined;
  loading: boolean;
  /** Herhangi bir mağaza eşleşmesi düşük güvenli mi ("eşleşmeyi kontrol et"). */
  lowConfidence: boolean;
}

export interface StoreTotals {
  storeId: StoreId;
  totalCents: number;
  /** Toplama katılan (fiyatlı eşleşmesi olan, işaretsiz) satır sayısı. */
  pricedCount: number;
  /** Eşleşmesi/fiyatı olmayan işaretsiz satır sayısı. */
  missingPriceCount: number;
}

export interface CartMatchesResult {
  byKey: Record<string, CartMatchView>;
  /** Her zaman [ah, jumbo] sırasında; SADECE işaretsiz satırları toplar. */
  totals: StoreTotals[];
  status: MarketMatchStatus;
  refresh: () => void;
}

/** Sepet içeriği parmak izi — adlar/birimler değişmedikçe koşu tekrarlanmaz. */
function cartFingerprint(items: readonly CartItemView[]): string {
  return items
    .map((item) => item.key)
    .sort()
    .join('|');
}

export function useCartMatches(items: readonly CartItemView[]): CartMatchesResult {
  const status = useMarketMatchStore((state) => state.status);
  const matchesByKey = useMarketMatchStore((state) => state.matchesByKey);
  const runMatches = useMarketMatchStore((state) => state.runMatches);

  const fingerprint = useMemo(() => cartFingerprint(items), [items]);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }
    void runMatches(
      items.map((item) => ({ key: item.key, name: item.name, qty: item.qty, unit: item.unit })),
      fingerprint
    );
    // items içeriği fingerprint ile temsil ediliyor — referans değişimi koşu tetiklemesin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, runMatches]);

  const byKey = useMemo(() => {
    const result: Record<string, CartMatchView> = {};
    for (const item of items) {
      const match = matchesByKey[item.key];
      const lowConfidence = match
        ? STORE_IDS.some((storeId) => {
            const storeMatch = match.perStore[storeId];
            return Boolean(storeMatch && storeMatch.confidence < LOW_CONFIDENCE_THRESHOLD);
          })
        : false;
      result[item.key] = { match, loading: status === 'loading' && !match, lowConfidence };
    }
    return result;
  }, [items, matchesByKey, status]);

  const totals = useMemo<StoreTotals[]>(() => {
    return STORE_IDS.map((storeId) => {
      let totalCents = 0;
      let pricedCount = 0;
      let missingPriceCount = 0;
      for (const item of items) {
        if (item.checked) {
          continue; // işaretli = alınmış; "bu mağazadan alırsam ne öderim" hesabına girmez
        }
        const storeMatch = matchesByKey[item.key]?.perStore[storeId];
        if (storeMatch && storeMatch.product.priceCents != null) {
          totalCents += storeMatch.product.priceCents;
          pricedCount += 1;
        } else {
          missingPriceCount += 1;
        }
      }
      return { storeId, totalCents, pricedCount, missingPriceCount };
    });
  }, [items, matchesByKey]);

  return {
    byKey,
    totals,
    status,
    refresh: () => {
      void runMatches(
        items.map((item) => ({ key: item.key, name: item.name, qty: item.qty, unit: item.unit })),
        fingerprint,
        true
      );
    },
  };
}
