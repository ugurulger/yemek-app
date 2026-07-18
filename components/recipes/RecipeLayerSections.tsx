import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Recipe } from '@/types/recipe';
import RecipeCard, { CARD_IMAGE_HEIGHT } from './RecipeCard';
import { chunkPairs, RecipeSectionHeader } from './RecipeList';
import RecipeSkeletonCard from './RecipeSkeletonCard';

export interface RecipeCardSlot {
  /** Stabil anahtar (plan index'i) — tüm yaşam döngüsü boyunca (planlanıyor → yükleniyor → hazır) aynı kalır. */
  key: string;
  /** Aşama 1 dönmediyse null (isim henüz bilinmiyor). */
  name: string | null;
  status: 'loading' | 'done' | 'error';
  recipe: Recipe | null;
  onRetry: () => void;
}

export interface RecipeDisplaySection {
  key: string;
  title: string;
  prominent: boolean;
  slots: RecipeCardSlot[];
}

interface RecipeLayerSectionsProps {
  sections: RecipeDisplaySection[];
  onPressRecipe: (id: string) => void;
}

/** Yüklenemeyen slot için grid hücresiyle aynı boyutta hata kartı. */
function SlotErrorCard({ slot }: { slot: RecipeCardSlot }) {
  const { t } = useTranslation();
  return (
    <View
      className="w-full items-center justify-center rounded-[20px] bg-white px-3"
      style={{ height: CARD_IMAGE_HEIGHT }}>
      <Text
        className="text-center font-sans text-xs text-red-500"
        numberOfLines={2}>
        {slot.name
          ? t('recipes.slotLoadFailedNamed', { name: slot.name })
          : t('recipes.slotLoadFailed')}
      </Text>
      <Pressable accessibilityRole="button" onPress={slot.onRetry} className="mt-2 active:scale-95">
        <Text className="font-sans-medium text-xs text-forest">{t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Tarif listesini tarif bazlı yükleme durumuna göre KADEMELİ/CANLI gösterir
 * (bkz. SKILL.md "MVP-15"): her tarifin detayı döner dönmez o kart tek
 * başına iskeletten dolu karta döner — bölümün TAMAMI birden görünmez. Bir
 * bölümde hiç slot yoksa (henüz o katmana ait tarif belirlenmediyse) başlık
 * da gizli kalır. Statik `RecipeList` ile aynı 2 SÜTUNLU grid düzenini
 * (gap 14 — birebir referans) ve bölüm başlıklarını kullanır; sayaç pili
 * yalnızca "Hemen Yapabilirsin" (prominent) bölümünde gösterilir.
 */
export default function RecipeLayerSections({ sections, onPressRecipe }: RecipeLayerSectionsProps) {
  const visibleSections = sections.filter((section) => section.slots.length > 0);

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}>
      {visibleSections.map((section, sectionIndex) => (
        <View key={section.key}>
          <RecipeSectionHeader
            title={section.title}
            count={section.prominent ? section.slots.length : undefined}
            first={sectionIndex === 0}
          />
          <View className="gap-[14px]">
            {chunkPairs(section.slots).map(([left, right], rowIndex) => (
              <View key={`${section.key}-${rowIndex}`} className="flex-row gap-[14px]">
                {[left, right].map((slot, cellIndex) => (
                  <View key={slot ? slot.key : `empty-${cellIndex}`} className="flex-1">
                    {slot &&
                      (slot.status === 'done' && slot.recipe ? (
                        <RecipeCard recipe={slot.recipe} onPress={onPressRecipe} />
                      ) : slot.status === 'error' ? (
                        <SlotErrorCard slot={slot} />
                      ) : (
                        <RecipeSkeletonCard name={slot.name ?? undefined} />
                      ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
