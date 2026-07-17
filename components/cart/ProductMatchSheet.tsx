import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from '@/components/ui';
import { formatPriceCents } from '@/lib/market/format';
import { formatQty } from '@/lib/recipes/recipe-math';
import { colors } from '@/lib/theme';
import { LOW_CONFIDENCE_THRESHOLD } from '@/services/matching/fuzzy';
import type { IngredientMatch, StoreMatch } from '@/services/matching/types';
import { getStoreProviders } from '@/services/stores';
import { STORE_IDS, type StoreId, type StoreProduct } from '@/services/stores/types';
import type { CartItemView } from '@/types/cart';

const STORE_NAMES: Record<StoreId, string> = { ah: 'Albert Heijn', jumbo: 'Jumbo' };

/** Defter satırı gölgesi kalıbı (CookbookPickerSheet ile aynı). */
const ROW_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 4,
  elevation: 2,
} as const;

export interface ProductMatchSheetProps {
  visible: boolean;
  onClose: () => void;
  item: CartItemView | null;
  match: IngredientMatch | undefined;
  /** Alternatif seçildi — cache'e kullanıcı düzeltmesi olarak yazılır. */
  onSelect: (storeId: StoreId, product: StoreProduct) => void;
}

/**
 * Eşleşme detayı + alternatif ürün seçimi sheet'i (CookbookPickerSheet
 * kalıbı). Mağaza başına: seçili ürün + arama adaylarından alternatifler;
 * altta Hollandaca manuel arama (iki mağazada birden arar). Seçim kalıcı
 * düzeltme olarak cache'e yazılır — feedback loop.
 */
export default function ProductMatchSheet({ visible, onClose, item, match, onSelect }: ProductMatchSheetProps) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Partial<Record<StoreId, StoreProduct[]>> | null>(null);

  // Sheet her açılışta temiz başlar.
  useEffect(() => {
    if (visible) {
      setQuery('');
      setSearchResults(null);
      setSearching(false);
    }
  }, [visible, item?.key]);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || searching) {
      return;
    }
    setSearching(true);
    try {
      const providers = getStoreProviders();
      const entries = await Promise.all(
        STORE_IDS.map(async (storeId) => {
          try {
            return [storeId, await providers[storeId].searchProducts(trimmed, { limit: 5 })] as const;
          } catch {
            return [storeId, []] as const;
          }
        })
      );
      setSearchResults(Object.fromEntries(entries));
    } finally {
      setSearching(false);
    }
  };

  if (!item) {
    return null;
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mb-1 font-serif text-[22px] text-forest">{item.name}</Text>
      <Text className="mb-3 font-sans text-[12.5px] text-muted">
        {formatQty(item.qty)} {item.unit} · Eşleşen ürünü kontrol et, gerekirse değiştir.
      </Text>

      <ScrollView style={{ maxHeight: 430 }} showsVerticalScrollIndicator={false}>
        {STORE_IDS.map((storeId) => {
          const storeMatch = match?.perStore[storeId];
          const alternatives = (searchResults?.[storeId] ?? storeMatch?.candidates ?? [])
            .filter((p) => p.sku !== storeMatch?.product.sku)
            .slice(0, 4);
          return (
            <View key={storeId} className="mb-4">
              <Text className="mb-2 font-sans-semibold text-[11px] uppercase tracking-wide text-muted">
                {STORE_NAMES[storeId]}
              </Text>

              {storeMatch ? (
                <ProductRow product={storeMatch.product} selected storeMatch={storeMatch} />
              ) : (
                <View className="rounded-[15px] bg-white px-4 py-3.5" style={ROW_SHADOW}>
                  <Text className="font-sans-medium text-[12.5px] text-muted">
                    Uygun ürün bulunamadı — aşağıdan arayıp seçebilirsin.
                  </Text>
                </View>
              )}

              {alternatives.length > 0 ? (
                <View className="mt-2 gap-[7px]">
                  {alternatives.map((product) => (
                    <ProductRow
                      key={product.sku}
                      product={product}
                      onPress={() => onSelect(storeId, product)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* Manuel arama — Hollandaca terim iki mağazada birden aranır. */}
      <View className="mt-1 flex-row items-center gap-2">
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          placeholder="Farklı ürün ara (Hollandaca)…"
          placeholderTextColor={colors.muted2}
          returnKeyType="search"
          className="flex-1 rounded-xl bg-white px-3.5 py-2.5 font-sans text-[13px] text-ink"
          style={ROW_SHADOW}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ürün ara"
          onPress={runSearch}
          className="h-10 w-10 items-center justify-center rounded-xl bg-forest active:scale-[0.96]">
          {searching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="search" size={16} color="#fff" />
          )}
        </Pressable>
      </View>
    </BottomSheet>
  );
}

interface ProductRowProps {
  product: StoreProduct;
  selected?: boolean;
  storeMatch?: StoreMatch;
  onPress?: () => void;
}

function ProductRow({ product, selected = false, storeMatch, onPress }: ProductRowProps) {
  const lowConfidence = storeMatch ? storeMatch.confidence < LOW_CONFIDENCE_THRESHOLD : false;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selected ? `Seçili ürün: ${product.name}` : `${product.name} ürününü seç`}
      disabled={!onPress}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-[15px] px-3 py-2.5 active:scale-[0.98] ${
        selected ? 'bg-forest' : 'bg-white'
      }`}
      style={selected ? undefined : ROW_SHADOW}>
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          className="h-10 w-10 rounded-lg bg-white"
          resizeMode="contain"
        />
      ) : (
        <View className={`h-10 w-10 items-center justify-center rounded-lg ${selected ? 'bg-white/15' : 'bg-cream'}`}>
          <Ionicons name="basket-outline" size={16} color={selected ? '#fff' : colors.muted} />
        </View>
      )}
      <View className="flex-1">
        <Text
          numberOfLines={2}
          className={`font-sans-medium text-[12px] ${selected ? 'text-white' : 'text-ink'}`}>
          {product.name}
        </Text>
        <Text className={`mt-[1px] font-sans text-[10px] ${selected ? 'text-white/70' : 'text-muted'}`}>
          {[product.brand, product.unitSize].filter(Boolean).join(' · ') || ' '}
        </Text>
        {selected && lowConfidence ? (
          <View className="mt-1 flex-row items-center gap-1">
            <Ionicons name="alert-circle-outline" size={11} color="#F5C88A" />
            <Text className="font-sans-medium text-[9.5px] text-white/80">
              Eşleşmeyi kontrol et — emin değiliz
            </Text>
          </View>
        ) : null}
      </View>
      <Text className={`font-sans-semibold text-[13px] ${selected ? 'text-white' : 'text-forest'}`}>
        {product.priceCents != null ? formatPriceCents(product.priceCents) : '—'}
      </Text>
    </Pressable>
  );
}
