import React from 'react';
import { FlatList, View } from 'react-native';
import type { Recipe } from '@/types/recipe';
import RecipeCard from './RecipeCard';

interface RecipeListProps {
  recipes: Recipe[];
  onPressRecipe: (id: string) => void;
}

export default function RecipeList({ recipes, onPressRecipe }: RecipeListProps) {
  if (recipes.length === 0) {
    return null;
  }

  return (
    <FlatList
      data={recipes}
      keyExtractor={(recipe) => recipe.id}
      renderItem={({ item }) => (
        <RecipeCard recipe={item} onPress={onPressRecipe} />
      )}
      ItemSeparatorComponent={() => <View className="h-2" />}
      contentContainerStyle={{ paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
