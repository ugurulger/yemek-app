import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';

import { formatPriceCents } from '@/lib/market/format';
import type { StoreTotals } from '@/lib/market/useCartMatches';
import { cardShadow, colors } from '@/lib/theme';
import type { MarketMatchStatus } from '@/store/marketMatchStore';
import type { StoreId } from '@/services/stores/types';

const STORE_NAMES: Record<StoreId, string> = { ah: 'Albert Heijn', jumbo: 'Jumbo' };

export interface StoreComparisonCardProps {
  totals: StoreTotals[];
  status: MarketMatchStatus;
  onPressStore: (storeId: StoreId) => void;
  onRetry: () => void;
}

/**
 * Sepet toplamlarının iki mağazalı karşılaştırma kartı — grid'in üstünde.
 * Ucuz mağaza yumuşak yeşil "En uygun" pili alır; fiyatı eksik satır sayısı
 * alt notta belirtilir. Yüklenirken iskelet, hata durumunda "Tekrar dene".
 */
export function StoreComparisonCard({ totals, status, onPressStore, onRetry }: StoreComparisonCardProps) {
  const { t } = useTranslation();
  if (status === 'loading' || status === 'idle') {
    return (
      <View className="mx-5 mb-4 rounded-2xl bg-white p-4" style={cardShadow}>
        <Text className="font-sans-medium text-[11px] text-muted">{t('market.comparingPrices')}</Text>
        <View className="mt-3 flex-row gap-3">
          {[0, 1].map((i) => (
            <View key={i} className="flex-1 gap-2">
              <View className="h-3 w-20 rounded-full bg-cream" />
              <View className="h-6 w-16 rounded-lg bg-cream" />
              <View className="h-8 rounded-xl bg-cream" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className="mx-5 mb-4 rounded-2xl bg-white p-4" style={cardShadow}>
        <Text className="font-sans-medium text-[12.5px] text-ink">{t('market.pricesUnavailable')}</Text>
        <Text className="mt-1 font-sans text-[11px] text-muted">
          {t('market.pricesUnavailableBody')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="mt-3 items-center rounded-xl bg-cream px-4 py-2 active:opacity-70">
          <Text className="font-sans-semibold text-[12px] text-forest">{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const priced = totals.filter((t) => t.pricedCount > 0);
  const cheapest =
    priced.length === totals.length && totals.length > 0
      ? totals.reduce((min, t) => (t.totalCents < min.totalCents ? t : min))
      : null;
  const missingTotal = Math.max(...totals.map((t) => t.missingPriceCount), 0);

  return (
    <View className="mx-5 mb-4 rounded-2xl bg-white p-4" style={cardShadow}>
      <View className="flex-row gap-3">
        {totals.map((storeTotals) => {
          const isCheapest = cheapest?.storeId === storeTotals.storeId && totals.length > 1;
          return (
            <View key={storeTotals.storeId} className="flex-1">
              <View className="flex-row items-center gap-[6px]">
                <Text className="font-sans-semibold text-[11px] uppercase tracking-wide text-muted">
                  {STORE_NAMES[storeTotals.storeId]}
                </Text>
                {isCheapest ? (
                  <View className="rounded-full bg-softgreen-bg px-[7px] py-[1px]">
                    <Text className="font-sans-semibold text-[9px] text-softgreen-text">
                      {t('market.cheapestBadge')}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-1 font-serif text-[24px] text-forest">
                {storeTotals.pricedCount > 0 ? formatPriceCents(storeTotals.totalCents) : '—'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('market.buyFromStoreA11y', {
                  store: STORE_NAMES[storeTotals.storeId],
                })}
                onPress={() => onPressStore(storeTotals.storeId)}
                className={`mt-2 flex-row items-center justify-center gap-1 rounded-xl px-3 py-2 active:scale-[0.98] ${
                  isCheapest ? 'bg-forest' : 'bg-cream'
                }`}>
                <Text
                  className={`font-sans-semibold text-[11.5px] ${isCheapest ? 'text-white' : 'text-forest'}`}>
                  {t('market.buyFromStore')}
                </Text>
                <Ionicons
                  name="open-outline"
                  size={12}
                  color={isCheapest ? '#fff' : colors.forest}
                />
              </Pressable>
            </View>
          );
        })}
      </View>
      {missingTotal > 0 ? (
        <Text className="mt-3 font-sans text-[10.5px] text-muted">
          {t('market.missingPriceNote', { count: missingTotal })}
        </Text>
      ) : null}
    </View>
  );
}
