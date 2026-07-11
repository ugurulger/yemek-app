import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { CartCategorySection } from '@/components/cart/CartCategorySection';
import { PrimaryButton } from '@/components/ui';
import { colors } from '@/lib/theme';
import { mergeCartEntries, useCartStore } from '@/store/cartStore';
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
            {/* Grid — referans 339: 2 sütun, gap 12, üstten hizalı. */}
            <View className="flex-row items-start gap-3 px-5">
              <View className="flex-1 gap-3">
                {leftColumn.map((section) => (
                  <CartCategorySection
                    key={section.category}
                    title={section.category}
                    items={section.items}
                    onToggle={toggleChecked}
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
