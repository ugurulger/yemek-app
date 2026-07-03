import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '@/types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: (id: string) => void;
}

export default function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  const matchColor =
    recipe.match_pct >= 80
      ? 'bg-emerald-900'
      : recipe.match_pct >= 50
        ? 'bg-amber-500'
        : 'bg-stone-400';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name} tarifini aç`}
      onPress={() => onPress(recipe.id)}
      className="flex-row items-center rounded-2xl bg-white p-3 ring-1 ring-stone-100 shadow-sm active:scale-95"
    >
      <Text style={{ fontSize: 32 }} className="mr-3">
        {recipe.emoji}
      </Text>

      <View className="flex-1">
        <Text
          style={{ fontFamily: 'Fraunces_600SemiBold' }}
          className="text-base text-stone-900"
          numberOfLines={1}
        >
          {recipe.name}
        </Text>

        <View className="mt-2 flex-row items-center flex-wrap">
          <View className="mr-2 mb-1 flex-row items-center rounded-full bg-stone-100 px-2 py-0.5">
            <Text
              style={{ fontFamily: 'Outfit_500Medium' }}
              className="text-xs text-stone-600"
            >
              {recipe.kcal} kcal
            </Text>
          </View>

          <View className="mr-2 mb-1 flex-row items-center rounded-full bg-stone-100 px-2 py-0.5">
            <Ionicons name="people-outline" size={12} color="#57534e" />
            <Text
              style={{ fontFamily: 'Outfit_500Medium' }}
              className="ml-1 text-xs text-stone-600"
            >
              {recipe.servings} kişilik
            </Text>
          </View>

          <View className="mr-2 mb-1 flex-row items-center rounded-full bg-stone-100 px-2 py-0.5">
            <Ionicons name="time-outline" size={12} color="#57534e" />
            <Text
              style={{ fontFamily: 'Outfit_500Medium' }}
              className="ml-1 text-xs text-stone-600"
            >
              {recipe.time_min} dk
            </Text>
          </View>

          <View
            className={`mb-1 flex-row items-center rounded-full px-2 py-0.5 ${matchColor}`}
          >
            <Text
              style={{ fontFamily: 'Outfit_500Medium' }}
              className="text-xs text-white"
            >
              %{recipe.match_pct} uyum
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
