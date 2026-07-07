import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RecipeImagePlaceholder from '@/components/recipes/RecipeImagePlaceholder';
import { useRecipeImage } from '@/services/images/useRecipeImage';
import type { Recipe } from '@/types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: (id: string) => void;
}

export default function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  // Lazy: görsel hazır değilse uri null döner (placeholder gösterilir) ve
  // üretim arka plandaki sıralı kuyruğa eklenir — bkz. services/images/
  const { uri: imageUri, isGenerating } = useRecipeImage(recipe, 'thumbnail');

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
      {/* Görsel alanı ve placeholder birebir aynı boyutta (80px kare) —
          görsel geldiğinde kart boyutu zıplamaz. */}
      <View className="mr-3">
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            className="h-20 w-20 rounded-xl bg-stone-100"
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <RecipeImagePlaceholder
            emoji={recipe.emoji}
            boxClassName="h-20 w-20 rounded-xl"
            emojiSize={34}
            pulsing={isGenerating}
          />
        )}
      </View>

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

          <View className="mr-2 mb-1 flex-row items-center rounded-full bg-stone-100 px-2 py-0.5">
            <Ionicons name="speedometer-outline" size={12} color="#57534e" />
            <Text
              style={{ fontFamily: 'Outfit_500Medium' }}
              className="ml-1 text-xs text-stone-600"
            >
              Zorluk: {recipe.difficulty}
            </Text>
          </View>

          <View
            className={`mr-2 mb-1 flex-row items-center rounded-full px-2 py-0.5 ${matchColor}`}
          >
            <Text
              style={{ fontFamily: 'Outfit_500Medium' }}
              className="text-xs text-white"
            >
              %{recipe.match_pct} uyum
            </Text>
          </View>

          {recipe.missing_count > 0 && (
            <View className="mb-1 flex-row items-center rounded-full bg-amber-500 px-2 py-0.5">
              <Ionicons name="basket-outline" size={12} color="white" />
              <Text
                style={{ fontFamily: 'Outfit_500Medium' }}
                className="ml-1 text-xs text-white"
              >
                {recipe.missing_count} eksik
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
