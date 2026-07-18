import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { computeMissing } from '@/lib/recipes/recipe-math';
import { colors } from '@/lib/theme';
import {
  expandInventoryForMatching,
  expandPantryForMatching,
} from '@/src/i18n/inventoryI18n';
import { mergeCartEntries, useCartStore } from '@/store/cartStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { usePantryStore } from '@/store/pantryStore';
import type { Recipe } from '@/types/recipe';
import RecipeCard from './RecipeCard';

interface RecipeListProps {
  recipes: Recipe[];
  onPressRecipe: (id: string) => void;
}

interface RecipeSection {
  title: string;
  data: Recipe[];
  /** Sayaç pili SADECE "Hemen Yapabilirsin" bölümünde gösterilir (referans:
   * "Küçük Bir Alışverişle" başlığında sayaç YOK). */
  count?: number;
}

/**
 * Bölüm başlığı — birebir referans: baseline hizalı, gap 8; h2 500 21px
 * Newsreader #23302B; sayaç pili 600 11px #2E7D5B, bg #DCEEE3, padding 3×9,
 * radius 20. İlk bölümde margin 24px üst 12px alt, sonrakilerde 28px üst.
 * `RecipeLayerSections` (canlı slot görünümü) da aynı başlığı kullanır.
 */
export function RecipeSectionHeader({
  title,
  count,
  first = false,
}: {
  title: string;
  count?: number;
  first?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View className={`flex-row items-baseline gap-2 ${first ? 'mt-6' : 'mt-7'} mb-3`}>
      <Text className="font-serif text-[21px] text-ink">{title}</Text>
      {count !== undefined && (
        <View className="rounded-[20px] bg-softgreen-bg px-[9px] py-[3px]">
          <Text className="font-sans-semibold text-[11px] text-softgreen-text">
            {t('recipes.sectionCount', { count })}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Diziyi 2 sütunlu grid satırlarına böler — tek sayıda ikinci hücre null. */
export function chunkPairs<T>(items: readonly T[]): [T, T | null][] {
  const rows: [T, T | null][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i], items[i + 1] ?? null]);
  }
  return rows;
}

/**
 * Tarifleri iki bölümde, 2 SÜTUNLU kart grid'iyle (gap 14 — birebir
 * referans) gösterir: "Hemen Yapabilirsin" (eksik yok) ve "Küçük Bir
 * Alışverişle" (eksik sayısına göre artan sıralı — MVP-16 eksik-bazlı
 * katmanlama). Liste sonunda sepet doluysa tam genişlik "Market sepetini
 * gör · N ürün" butonu bulunur.
 */
export default function RecipeList({ recipes, onPressRecipe }: RecipeListProps) {
  const { t } = useTranslation();
  const inventory = useInventoryStore((state) => state.items);
  const pantryItems = usePantryStore((state) => state.items);
  const cartEntries = useCartStore((state) => state.entries);
  const checkedKeys = useCartStore((state) => state.checkedKeys);

  // Bölümleme/sıralama, kart rozetleriyle AYNI kaynaktan (canlı computeMissing)
  // hesaplanır — üretim anındaki `missing_count` envanter değiştikçe eskiyebilir
  // ve rozetle çelişen bir sıra üretirdi (Faz 3 entegrasyon düzeltmesi).
  // Envanter/kiler adları İKİ DİLLİ varyantlarıyla genişletilir (bkz.
  // src/i18n/inventoryI18n.ts) — EN gösterilen tarifin "salt" malzemesi TR
  // kilerdeki "Tuz" ile de eşleşsin diye.
  const withLiveMissing = useMemo(() => {
    const matchInventory = expandInventoryForMatching(inventory);
    const matchPantry = expandPantryForMatching(pantryItems);
    return recipes.map((recipe) => ({
      recipe,
      liveMissing: computeMissing(recipe, matchInventory, matchPantry).length,
    }));
  }, [recipes, inventory, pantryItems]);

  // İş 1: fine dining tarifleri eksik-bazlı bölümlemeye karışmaz — mevcut
  // tasarım diliyle tutarlı ayrı bir bölüm başlığı altında, listenin sonunda.
  const fineDining = withLiveMissing
    .filter((entry) => entry.recipe.category === 'fine-dining')
    .map((entry) => entry.recipe);

  // Sepetteki birleşik (malzeme bazında tekilleşmiş) ürün sayısı.
  const cartCount = useMemo(
    () => mergeCartEntries(cartEntries, checkedKeys).length,
    [cartEntries, checkedKeys]
  );

  if (recipes.length === 0) {
    return null;
  }

  const standard = withLiveMissing.filter((entry) => entry.recipe.category !== 'fine-dining');
  const ready = standard
    .filter((entry) => entry.liveMissing === 0)
    .map((entry) => entry.recipe);
  const withShopping = standard
    .filter((entry) => entry.liveMissing > 0)
    .sort((a, b) => a.liveMissing - b.liveMissing)
    .map((entry) => entry.recipe);

  const sections: RecipeSection[] = [];
  if (ready.length > 0) {
    sections.push({ title: t('recipes.sectionReady'), data: ready, count: ready.length });
  }
  if (withShopping.length > 0) {
    sections.push({ title: t('recipes.sectionShopping'), data: withShopping });
  }
  if (fineDining.length > 0) {
    sections.push({ title: t('recipes.sectionFineDining'), data: fineDining });
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 120 }}>
      {sections.map((section, sectionIndex) => (
        <View key={section.title}>
          <RecipeSectionHeader
            title={section.title}
            count={section.count}
            first={sectionIndex === 0}
          />
          <View className="gap-[14px]">
            {chunkPairs(section.data).map(([left, right], rowIndex) => (
              <View key={`${section.title}-${rowIndex}`} className="flex-row gap-[14px]">
                <View className="flex-1">
                  <RecipeCard recipe={left} onPress={onPressRecipe} />
                </View>
                <View className="flex-1">
                  {right && <RecipeCard recipe={right} onPress={onPressRecipe} />}
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Liste sonu (referans): tam genişlik market butonu — bg #EDEAE3,
          #1F4A3D 600 13px, padding 14, radius 16, cart ikonu 17, gap 8,
          üst margin 22. Sepet boşsa gizli. */}
      {cartCount > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/market')}
          className="mt-[22px] w-full flex-row items-center justify-center rounded-2xl bg-sand p-3.5 active:scale-95">
          <Ionicons name="cart-outline" size={17} color={colors.forest} />
          <Text className="ml-2 font-sans-semibold text-[13px] text-forest">
            {t('recipes.viewCart', { count: cartCount })}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
