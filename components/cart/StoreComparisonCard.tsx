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
 *
 * KOMPAKT oran (tarif şeridi işi): ekranın yıldızı Recipes şeridi + kategori
 * listesi — bu kart destekleyici kaldığı için dikeyde sıkıştırıldı (fiyat
 * 24→18px, buton tek satır kısa etiketli, karar bandı + fiyat notu tek
 * satırda birleşik).
 */
export function StoreComparisonCard({ totals, status, onPressStore, onRetry }: StoreComparisonCardProps) {
  const { t } = useTranslation();
  if (status === 'loading' || status === 'idle') {
    return (
      <View className="mx-5 mb-3 rounded-2xl bg-white p-3" style={cardShadow}>
        <Text className="font-sans-medium text-[11px] text-muted">{t('market.comparingPrices')}</Text>
        <View className="mt-2 flex-row gap-2.5">
          {[0, 1].map((i) => (
            <View key={i} className="flex-1 gap-1.5">
              <View className="h-3 w-20 rounded-full bg-cream" />
              <View className="h-5 w-16 rounded-lg bg-cream" />
              <View className="h-6 rounded-lg bg-cream" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className="mx-5 mb-3 rounded-2xl bg-white p-3" style={cardShadow}>
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

  // P8-4: mağaza sütunları KENDİ marka renklerinde (logo yok, yalnız renk;
  // landing .price-demo ile aynı tasarım): AH mavi + beyaz metin, Jumbo sarı
  // + koyu metin. Kazanan "Best price" rozeti (forest) alır; kartın altında
  // "✓ {store} wins today" karar bandı.
  const STORE_STYLES: Record<StoreId, { bg: string; text: string; subtle: string }> = {
    ah: { bg: colors.ahBlue, text: '#FFFFFF', subtle: 'rgba(255,255,255,0.85)' },
    jumbo: { bg: colors.jumboYellow, text: colors.jumboInk, subtle: 'rgba(34,27,0,0.75)' },
  };

  return (
    <View className="mx-5 mb-3 rounded-2xl bg-white p-3" style={cardShadow}>
      <View className="flex-row gap-2.5">
        {totals.map((storeTotals) => {
          const isCheapest = cheapest?.storeId === storeTotals.storeId && totals.length > 1;
          const storeStyle = STORE_STYLES[storeTotals.storeId];
          return (
            <View
              key={storeTotals.storeId}
              className="flex-1 rounded-xl px-2.5 py-2"
              style={{ backgroundColor: storeStyle.bg }}>
              <View className="flex-row items-center gap-[6px]">
                <Text
                  numberOfLines={1}
                  className="shrink font-sans-semibold text-[10px] uppercase tracking-wide"
                  style={{ color: storeStyle.subtle }}>
                  {STORE_NAMES[storeTotals.storeId]}
                </Text>
                {isCheapest ? (
                  <View className="rounded-full bg-forest px-[7px] py-[1px]">
                    <Text className="font-sans-semibold text-[9px] text-white">
                      {t('market.cheapestBadge')}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-[2px] font-serif text-[18px]" style={{ color: storeStyle.text }}>
                {storeTotals.pricedCount > 0 ? formatPriceCents(storeTotals.totalCents) : '–'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('market.buyFromStoreA11y', {
                  store: STORE_NAMES[storeTotals.storeId],
                })}
                onPress={() => onPressStore(storeTotals.storeId)}
                className="mt-1.5 flex-row items-center justify-center gap-1 rounded-lg bg-white px-2 py-[5px] active:scale-[0.98]">
                <Text numberOfLines={1} className="font-sans-semibold text-[10.5px] text-forest">
                  {t('market.buyFromStoreShort')}
                </Text>
                <Ionicons name="open-outline" size={11} color={colors.forest} />
              </Pressable>
            </View>
          );
        })}
      </View>
      {/* Karar bandı + fiyat notu TEK kompakt satırda (dikey oran kararı). */}
      {cheapest || missingTotal > 0 ? (
        <View className="mt-2 flex-row items-center gap-2">
          {cheapest ? (
            <View className="rounded-full bg-softgreen-bg px-2.5 py-1">
              <Text className="font-sans-semibold text-[11px] text-softgreen-text">
                {t('market.winsToday', { store: STORE_NAMES[cheapest.storeId] })}
              </Text>
            </View>
          ) : null}
          {missingTotal > 0 ? (
            <Text className="flex-1 font-sans text-[9.5px] leading-[13px] text-muted" numberOfLines={2}>
              {t('market.missingPriceNote', { count: missingTotal })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
