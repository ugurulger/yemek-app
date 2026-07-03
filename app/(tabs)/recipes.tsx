import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import RecipeList from '@/components/recipes/RecipeList';
import { generateRecipes, RecipeGenerationError } from '@/lib/claude/generateRecipes';
import { useInventoryStore } from '@/store/inventoryStore';
import { useRecipeStore } from '@/store/recipeStore';

export default function TariflerScreen() {
  const inventoryItems = useInventoryStore((state) => state.items);
  const recipes = useRecipeStore((state) => state.recipes);
  const setRecipes = useRecipeStore((state) => state.setRecipes);

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGenerateRecipes() {
    setErrorMessage(null);
    setIsGenerating(true);
    try {
      const generated = await generateRecipes(inventoryItems);
      setRecipes(generated);
    } catch (error) {
      const message =
        error instanceof RecipeGenerationError || error instanceof Error
          ? error.message
          : 'Bir şeyler ters gitti, tekrar deneyin.';
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  }

  const hasInventory = inventoryItems.length > 0;
  const hasRecipes = recipes.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-stone-50" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Text className="text-3xl text-emerald-900" style={{ fontFamily: 'Fraunces_700Bold' }}>
          Tarifler
        </Text>
        {hasInventory && hasRecipes && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tarifleri yeniden oluştur"
            onPress={handleGenerateRecipes}
            disabled={isGenerating}
            className="h-11 w-11 items-center justify-center rounded-full bg-emerald-900 active:scale-95">
            {isGenerating ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="refresh" size={20} color="white" />
            )}
          </Pressable>
        )}
      </View>

      {isGenerating && (
        <View className="mx-5 mb-2 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-100">
          <ActivityIndicator color="#064e3b" size="small" />
          <Text
            className="ml-3 text-sm text-stone-700"
            style={{ fontFamily: 'Outfit_400Regular' }}>
            Tarifler hazırlanıyor…
          </Text>
        </View>
      )}

      {errorMessage && (
        <View className="mx-5 mb-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-100">
          <Text className="text-sm text-red-500" style={{ fontFamily: 'Outfit_500Medium' }}>
            {errorMessage}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleGenerateRecipes}
            className="mt-2 self-start active:scale-95">
            <Text className="text-sm text-emerald-900" style={{ fontFamily: 'Outfit_500Medium' }}>
              Tekrar dene
            </Text>
          </Pressable>
        </View>
      )}

      {hasRecipes ? (
        <View className="flex-1 px-5">
          <RecipeList
            recipes={recipes}
            onPressRecipe={(id) => router.push(`/recipe/${id}`)}
          />
        </View>
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-full items-center rounded-2xl bg-white p-8 shadow-sm ring-1 ring-stone-100">
            <Text className="text-5xl">🍲</Text>
            <Text
              className="mt-4 text-center text-lg text-stone-900"
              style={{ fontFamily: 'Fraunces_600SemiBold' }}>
              Bugün ne pişsin?
            </Text>
            <Text
              className="mt-2 text-center text-sm text-stone-500"
              style={{ fontFamily: 'Outfit_400Regular' }}>
              {hasInventory
                ? 'Envanterine göre tarif önerileri oluşturalım.'
                : 'Mutfağım sayfasından malzeme ekledikçe burada tarif önerileri belirecek.'}
            </Text>
            {hasInventory && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tarif oluştur"
                onPress={handleGenerateRecipes}
                disabled={isGenerating}
                className="mt-5 flex-row items-center rounded-2xl bg-emerald-900 px-5 py-3 active:scale-95">
                <Ionicons name="sparkles-outline" size={18} color="white" />
                <Text
                  className="ml-2 text-sm text-white"
                  style={{ fontFamily: 'Outfit_500Medium' }}>
                  Tarif oluştur
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
