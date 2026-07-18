import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';

import { SectionLabel } from '@/components/ui';
import { formatPriceCents } from '@/lib/market/format';
import type { CartMatchView } from '@/lib/market/useCartMatches';
import { formatQty } from '@/lib/recipes/recipe-math';
import { cardShadow, colors } from '@/lib/theme';
import { STORE_IDS, type StoreId } from '@/services/stores/types';
import type { CartItemView } from '@/types/cart';

/** Satır içi fiyat şeridindeki kısa mağaza adları. */
const STORE_SHORT_NAMES: Record<StoreId, string> = { ah: 'AH', jumbo: 'Jumbo' };

/** Görselde birimler kısaltılmış görünür ("4 ad") — sadece bilinenler kısalır. */
const UNIT_ABBREVIATIONS: Record<string, string> = {
  adet: 'ad',
};

function shortUnit(unit: string): string {
  const normalized = unit.trim().toLocaleLowerCase('tr-TR');
  return UNIT_ABBREVIATIONS[normalized] ?? unit.trim();
}

export interface CartCategorySectionProps {
  /** Kategori adı — UPPERCASE'e burada çevrilir ("MEYVE & SEBZE"). */
  title: string;
  items: CartItemView[];
  onToggle: (key: string) => void;
  /** AH/Jumbo eşleşme görünümleri (satır anahtarıyla) — verilmezse fiyat şeridi çizilmez. */
  matchesByKey?: Record<string, CartMatchView>;
  /** Fiyat şeridine/uyarı ikonuna dokununca (alternatif ürün sheet'i açılır). */
  onPressDetails?: (key: string) => void;
}

/**
 * Market Sepeti kategori bloğu — BİREBİR referans:
 * design/reference/Mutfagim.dc.html satır 339-363 + 909-916.
 *
 * Etiket kartın DIŞINDA (600 10px uppercase ls .5, mb 7); kart beyaz,
 * radius 16, padding 2px 12px, gölge 0 2px 10px -4px rgba(31,74,61,.12).
 */
export function CartCategorySection({
  title,
  items,
  onToggle,
  matchesByKey,
  onPressDetails,
}: CartCategorySectionProps) {
  return (
    <View>
      {/* NativeWind'in `uppercase` sınıfı Türkçe i/İ dönüşümünü garanti etmez —
          tr-TR locale ile önden çeviriyoruz. */}
      <SectionLabel size="sm" className="mb-[7px]">
        {title.toLocaleUpperCase('tr-TR')}
      </SectionLabel>
      <View className="rounded-2xl bg-white px-3 py-[2px]" style={cardShadow}>
        {items.map((item) => (
          <CartItemRow
            key={item.key}
            item={item}
            onToggle={() => onToggle(item.key)}
            matchView={matchesByKey?.[item.key]}
            onPressDetails={onPressDetails ? () => onPressDetails(item.key) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

interface CartItemRowProps {
  item: CartItemView;
  onToggle: () => void;
  matchView?: CartMatchView;
  onPressDetails?: () => void;
}

/**
 * Satır altındaki kompakt fiyat şeridi: "AH €1,29 · Jumbo €1,15" — ucuz
 * mağaza forest/semibold, eşleşmeyen taraf "—". Düşük güvenli eşleşme amber
 * uyarı ikonu taşır; dokunmak alternatif ürün sheet'ini açar (checkbox
 * jesti satır gövdesinde kalır, bu şerit AYRI pressable).
 */
function PriceStrip({ matchView, onPressDetails }: { matchView: CartMatchView; onPressDetails?: () => void }) {
  const { t } = useTranslation();
  const { match, loading, lowConfidence } = matchView;
  if (loading) {
    return (
      <Text className="mt-[3px] font-sans text-[9.5px] text-muted">{t('market.pricesLoading')}</Text>
    );
  }
  if (!match) {
    return null;
  }
  const prices = STORE_IDS.map((storeId) => ({
    storeId,
    cents: match.perStore[storeId]?.product.priceCents ?? null,
  }));
  const pricedValues = prices.filter((p) => p.cents != null).map((p) => p.cents!);
  const minPrice = pricedValues.length > 0 ? Math.min(...pricedValues) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('market.matchDetailsA11y')}
      onPress={onPressDetails}
      hitSlop={6}
      className="mt-[3px] flex-row items-center gap-[5px] active:opacity-60">
      {prices.map(({ storeId, cents }, index) => {
        const isCheapest = cents != null && cents === minPrice && pricedValues.length > 1;
        return (
          <View key={storeId} className="flex-row items-center gap-[5px]">
            {index > 0 ? <Text className="font-sans text-[9.5px] text-muted">·</Text> : null}
            <Text
              className={
                isCheapest
                  ? 'font-sans-semibold text-[9.5px] text-forest'
                  : 'font-sans text-[9.5px] text-muted'
              }>
              {STORE_SHORT_NAMES[storeId]} {cents != null ? formatPriceCents(cents) : '—'}
            </Text>
          </View>
        );
      })}
      {lowConfidence ? (
        <Ionicons name="alert-circle-outline" size={11} color={colors.amberText} />
      ) : null}
    </Pressable>
  );
}

/**
 * Satır (referans 345-358): üstten hizalı, gap 9, padding 9px 0, her satırda
 * 1px üst çizgi rgba(31,74,61,.07). Checkbox 19×19 r6 (boxStyle, 914);
 * ad 500 12.5px (nameStyle, 915); miktar 600 10.5px; tarif etiketi 9.5px.
 */
function CartItemRow({ item, onToggle, matchView, onPressDetails }: CartItemRowProps) {
  const { t } = useTranslation();
  // 2'den fazla kaynak tarif tek pill'e katlanır: "3 tarif".
  const pills =
    item.recipeNames.length > 2
      ? [t('market.recipePill', { count: item.recipeNames.length })]
      : item.recipeNames;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      accessibilityLabel={item.name}
      className="flex-row items-start gap-[9px] py-[9px] active:opacity-70"
      style={{ borderTopWidth: 1, borderTopColor: colors.divider }}>
      {/* Checkbox: işaretsiz beyaz + 2px #CBD3CD çerçeve; işaretli forest dolu + ✓ 11 */}
      <View
        className={`h-[19px] w-[19px] items-center justify-center rounded-md ${
          item.checked ? 'bg-forest' : 'border-2 bg-white'
        }`}
        style={item.checked ? undefined : { borderColor: colors.checkboxBorder }}>
        {item.checked ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
      </View>

      <View className="flex-1">
        <View className="flex-row items-baseline justify-between gap-[6px]">
          <Text
            className={`flex-1 font-sans-medium text-[12.5px] ${
              item.checked ? 'text-checkedtext line-through' : 'text-ink'
            }`}>
            {item.name}
          </Text>
          <Text className="font-sans-semibold text-[10.5px] text-muted">
            {formatQty(item.qty)} {shortUnit(item.unit)}
          </Text>
        </View>

        {pills.length > 0 ? (
          <View className="mt-1 flex-row flex-wrap gap-1">
            {pills.map((pill) => (
              <View key={pill} className="max-w-full rounded-xl bg-recipetag-bg px-[7px] py-[2px]">
                <Text
                  numberOfLines={1}
                  className="font-sans-medium text-[9.5px] text-recipetag-text">
                  {pill}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {matchView ? <PriceStrip matchView={matchView} onPressDetails={onPressDetails} /> : null}
      </View>
    </Pressable>
  );
}
