import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { CartCategorySection } from '@/components/cart/CartCategorySection';
import ProductMatchSheet from '@/components/cart/ProductMatchSheet';
import { StoreComparisonCard } from '@/components/cart/StoreComparisonCard';
import { PrimaryButton } from '@/components/ui';
import { openStore } from '@/lib/market/storeLinks';
import { useCartMatches } from '@/lib/market/useCartMatches';
import { colors } from '@/lib/theme';
import type { StoreId, StoreProduct } from '@/services/stores/types';
import { mergeCartEntries, useCartStore } from '@/store/cartStore';
import { useMarketMatchStore } from '@/store/marketMatchStore';
import { showToast } from '@/store/toastStore';
import type { CartItemView } from '@/types/cart';
import { INGREDIENT_CATEGORIES, type IngredientCategory } from '@/types/recipe';

interface CartSection {
  category: IngredientCategory;
  items: CartItemView[];
}

/** Birleşik satırları kategoriye göre gruplar — SADECE dolu kategoriler döner. */
function buildSections(items: CartItemView[]): CartSection[] {
  return INGREDIENT_CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  })).filter((section) => section.items.length > 0);
}

/**
 * Kategorileri iki sütuna masonry benzeri dağıtır (görsel 11): her kategori
 * sırayla o an daha KISA olan sütuna eklenir. Yükseklik tahmini = satır
 * sayısı + başlık payı (2) — piksel ölçmeden görsel denge için yeterli.
 */
function distributeColumns(sections: CartSection[]): [CartSection[], CartSection[]] {
  const left: CartSection[] = [];
  const right: CartSection[] = [];
  let leftWeight = 0;
  let rightWeight = 0;
  for (const section of sections) {
    const weight = section.items.length + 2;
    if (leftWeight <= rightWeight) {
      left.push(section);
      leftWeight += weight;
    } else {
      right.push(section);
      rightWeight += weight;
    }
  }
  return [left, right];
}

/** Market Sepeti — spec §6, görsel 11-market-sepeti.png. */
export default function MarketScreen() {
  const entries = useCartStore((state) => state.entries);
  const checkedKeys = useCartStore((state) => state.checkedKeys);
  const toggleChecked = useCartStore((state) => state.toggleChecked);
  const completeAll = useCartStore((state) => state.completeAll);
  const clearCart = useCartStore((state) => state.clearCart);

  const items = useMemo(() => mergeCartEntries(entries, checkedKeys), [entries, checkedKeys]);
  const [leftColumn, rightColumn] = useMemo(() => distributeColumns(buildSections(items)), [items]);

  const isEmpty = items.length === 0;
  const checkedCount = items.filter((item) => item.checked).length;
  const allChecked = !isEmpty && checkedCount === items.length;

  // AH/Jumbo fiyat karşılaştırması — sepet değişince otomatik koşar.
  const { byKey, totals, status, refresh } = useCartMatches(items);
  const applyCorrection = useMarketMatchStore((state) => state.applyCorrection);
  const storeHealth = useMarketMatchStore((state) => state.storeHealth);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const detailItem = detailKey ? (items.find((item) => item.key === detailKey) ?? null) : null;

  const downStores = (Object.entries(storeHealth) as [StoreId, boolean][])
    .filter(([, ok]) => !ok)
    .map(([storeId]) => (storeId === 'ah' ? 'Albert Heijn' : 'Jumbo'));

  const handleSelectAlternative = (storeId: StoreId, product: StoreProduct) => {
    if (detailKey) {
      applyCorrection(detailKey, storeId, product);
      showToast('Eşleşme güncellendi');
    }
  };

  const handlePressStore = (storeId: StoreId) => {
    // Yalnızca yönlendirme — karşı uygulamanın sepeti doldurulmaz (kapsam kararı).
    void openStore(storeId).catch(() => showToast('Mağaza açılamadı'));
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      {/* Başlık — referans 336-337: h1 500 34px Newsreader, margin 6 üst 2 alt;
          alt metin 400 13px, mb 22 (boşken de başlık aynı kalır). */}
      <View className="px-5 pt-2">
        <Text className="mb-[2px] mt-[6px] font-serif text-[34px] text-forest">Market Sepeti</Text>
        {!isEmpty ? (
          <Text className="mb-[22px] font-sans text-[13px] text-muted">
            Seçtiğin tariflerdeki eksik malzemeler · {items.length} ürün
          </Text>
        ) : null}
      </View>

      {isEmpty ? (
        <EmptyCart />
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Mağaza servis uyarısı — health-check başarısızsa ince amber banner. */}
            {downStores.length > 0 ? (
              <View className="mx-5 mb-3 flex-row items-center gap-2 rounded-xl bg-amber-soft px-3.5 py-2.5">
                <Ionicons name="warning-outline" size={14} color={colors.amberText} />
                <Text className="flex-1 font-sans-medium text-[11px] text-amber-text">
                  {downStores.join(' ve ')} fiyatları şu an alınamıyor
                </Text>
              </View>
            ) : null}

            {/* AH vs Jumbo toplam karşılaştırması. */}
            <StoreComparisonCard
              totals={totals}
              status={status}
              onPressStore={handlePressStore}
              onRetry={refresh}
            />

            {/* Grid — referans 339: 2 sütun, gap 12, üstten hizalı. */}
            <View className="flex-row items-start gap-3 px-5">
              <View className="flex-1 gap-3">
                {leftColumn.map((section) => (
                  <CartCategorySection
                    key={section.category}
                    title={section.category}
                    items={section.items}
                    onToggle={toggleChecked}
                    matchesByKey={byKey}
                    onPressDetails={setDetailKey}
                  />
                ))}
              </View>
              <View className="flex-1 gap-3">
                {rightColumn.map((section) => (
                  <CartCategorySection
                    key={section.category}
                    title={section.category}
                    items={section.items}
                    onToggle={toggleChecked}
                    matchesByKey={byKey}
                    onPressDetails={setDetailKey}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Sabit alt CTA — referans 366-369: hepsi işaretli değilken
              "Tümünü tamamla · {işaretli}/{toplam}"; hepsi işaretliyse
              "Listeyi temizle" (işlev kararı korunuyor). */}
          <View className="px-5 pb-3 pt-2">
            {allChecked ? (
              <PrimaryButton label="Listeyi temizle" variant="light" size="cta" onPress={clearCart} />
            ) : (
              <PrimaryButton
                label={`Tümünü tamamla · ${checkedCount}/${items.length}`}
                size="cta"
                onPress={completeAll}
              />
            )}
          </View>

          <ProductMatchSheet
            visible={detailKey !== null}
            onClose={() => setDetailKey(null)}
            item={detailItem}
            match={detailKey ? byKey[detailKey]?.match : undefined}
            onSelect={handleSelectAlternative}
          />
        </>
      )}
    </SafeAreaView>
  );
}

/** Boş durum — yönlendirmeli (spec: asla sadece "Liste boş" yazma). */
function EmptyCart() {
  return (
    <View className="flex-1 items-center justify-center px-10 pb-16">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-white">
        <Ionicons name="cart-outline" size={30} color={colors.muted} />
      </View>
      <Text className="mt-4 font-serif text-[24px] text-ink">Sepetin boş</Text>
      <Text className="mt-2 text-center font-sans text-[13px] leading-[19px] text-muted">
        Tarifler sayfasında bir tarifin &apos;eksik&apos; rozetine dokunarak eksik malzemeleri
        buraya ekleyebilirsin.
      </Text>
    </View>
  );
}
