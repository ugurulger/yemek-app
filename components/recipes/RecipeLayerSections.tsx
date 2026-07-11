import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { Recipe } from '@/types/recipe';
import RecipeCard from './RecipeCard';
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

/**
 * Tarif listesini tarif bazlı yükleme durumuna göre KADEMELİ/CANLI gösterir
 * (bkz. SKILL.md "MVP-15"): her tarifin detayı döner dönmez o kart tek
 * başına iskeletten dolu karta döner — bölümün TAMAMI birden görünmez. Bir
 * bölümde hiç slot yoksa (henüz o katmana ait tarif belirlenmediyse) başlık
 * da gizli kalır.
 */
export default function RecipeLayerSections({ sections, onPressRecipe }: RecipeLayerSectionsProps) {
  const visibleSections = sections.filter((section) => section.slots.length > 0);

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {visibleSections.map((section) => (
        <View key={section.key}>
          <View className="flex-row bg-stone-50 pb-2 pt-3">
            <View
              className={`rounded-full px-3 py-1 ${
                section.prominent ? 'bg-emerald-900' : 'bg-stone-100'
              }`}
            >
              <Text
                className={`text-sm ${section.prominent ? 'text-white' : 'text-stone-700'}`}
                style={{ fontFamily: 'Outfit_600SemiBold' }}
              >
                {section.title}
              </Text>
            </View>
          </View>

          {section.slots.map((slot) => (
            <View key={slot.key} className="mb-2">
              {slot.status === 'done' && slot.recipe ? (
                <RecipeCard recipe={slot.recipe} onPress={onPressRecipe} />
              ) : slot.status === 'error' ? (
                <View className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-100">
                  <Text
                    className="flex-1 text-sm text-red-500"
                    style={{ fontFamily: 'Outfit_400Regular' }}
                    numberOfLines={1}
                  >
                    {slot.name ? `"${slot.name}" yüklenemedi` : 'Tarif yüklenemedi'}
                  </Text>
                  <Pressable accessibilityRole="button" onPress={slot.onRetry} className="ml-2 active:scale-95">
                    <Text className="text-sm text-emerald-900" style={{ fontFamily: 'Outfit_500Medium' }}>
                      Tekrar dene
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <RecipeSkeletonCard name={slot.name ?? undefined} />
              )}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
