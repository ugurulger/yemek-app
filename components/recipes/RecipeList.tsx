import React from 'react';
import { SectionList, Text, View } from 'react-native';
import type { Recipe } from '@/types/recipe';
import RecipeCard from './RecipeCard';

interface RecipeListProps {
  recipes: Recipe[];
  onPressRecipe: (id: string) => void;
}

interface RecipeSection {
  title: string;
  prominent: boolean;
  data: Recipe[];
}

/**
 * Tarifleri iki bölümde gösterir: "Hemen Yapabilirsin" (hiç eksik malzeme
 * yok, üstte/belirgin) ve "Küçük Bir Alışverişle" (geri kalanlar, eksik
 * sayısına göre artan sıralı — bkz. SKILL.md "MVP-16" eksik-bazlı
 * katmanlama). Bölüm başlıkları MVP-10'daki grup başlığı chip stiliyle
 * tutarlıdır.
 */
export default function RecipeList({ recipes, onPressRecipe }: RecipeListProps) {
  if (recipes.length === 0) {
    return null;
  }

  const ready = recipes.filter((recipe) => recipe.missing_count === 0);
  const withShopping = recipes
    .filter((recipe) => recipe.missing_count > 0)
    .sort((a, b) => a.missing_count - b.missing_count);

  const sections: RecipeSection[] = [];
  if (ready.length > 0) {
    sections.push({ title: 'Hemen Yapabilirsin', prominent: true, data: ready });
  }
  if (withShopping.length > 0) {
    sections.push({ title: 'Küçük Bir Alışverişle', prominent: false, data: withShopping });
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(recipe) => recipe.id}
      renderItem={({ item }) => <RecipeCard recipe={item} onPress={onPressRecipe} />}
      renderSectionHeader={({ section }) => (
        <View className="flex-row bg-stone-50 pb-2 pt-3">
          <View
            className={`rounded-full px-3 py-1 ${
              section.prominent ? 'bg-emerald-900' : 'bg-stone-100'
            }`}>
            <Text
              className={`text-sm ${section.prominent ? 'text-white' : 'text-stone-700'}`}
              style={{ fontFamily: 'Outfit_600SemiBold' }}>
              {section.title}
            </Text>
          </View>
        </View>
      )}
      ItemSeparatorComponent={() => <View className="h-2" />}
      contentContainerStyle={{ paddingBottom: 16 }}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
    />
  );
}
