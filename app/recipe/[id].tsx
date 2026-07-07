import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useRecipeStore } from '@/store/recipeStore';

import RecipeHeroImage from '@/components/recipes/RecipeHeroImage';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipeStore((state) => state.getRecipeById(id));

  if (!recipe) {
    return (
      <SafeAreaView className="flex-1 bg-stone-50" edges={['top']}>
        <View className="px-5 pt-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri git"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-stone-100 active:scale-95">
            <Ionicons name="chevron-back" size={22} color="#064e3b" />
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <View className="w-full items-center rounded-2xl bg-white p-8 shadow-sm ring-1 ring-stone-100">
            <Text className="text-5xl">🔍</Text>
            <Text
              className="mt-4 text-center text-lg text-stone-900"
              style={{ fontFamily: 'Fraunces_600SemiBold' }}>
              Tarif bulunamadı
            </Text>
            <Text
              className="mt-2 text-center text-sm text-stone-500"
              style={{ fontFamily: 'Outfit_400Regular' }}>
              Bu tarif artık mevcut değil ya da kaldırılmış olabilir.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri dön"
              onPress={() => router.back()}
              className="mt-5 flex-row items-center rounded-2xl bg-emerald-900 px-5 py-3 active:scale-95">
              <Ionicons name="chevron-back" size={18} color="white" />
              <Text className="ml-2 text-sm text-white" style={{ fontFamily: 'Outfit_500Medium' }}>
                Geri dön
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-stone-50" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between pt-4 pb-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri git"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-stone-100 active:scale-95">
            <Ionicons name="chevron-back" size={22} color="#064e3b" />
          </Pressable>
        </View>

        <View className="mt-2 items-center">
          <RecipeHeroImage recipe={recipe} />
          <Text
            className="mt-3 text-center text-3xl text-emerald-900"
            style={{ fontFamily: 'Fraunces_700Bold' }}>
            {recipe.name}
          </Text>
        </View>

        <View className="mt-5 flex-row flex-wrap items-center justify-center gap-2">
          <View className="flex-row items-center rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-stone-100">
            <Ionicons name="flame-outline" size={14} color="#064e3b" />
            <Text
              className="ml-1.5 text-xs text-stone-700"
              style={{ fontFamily: 'Outfit_500Medium' }}>
              {recipe.kcal} kcal
            </Text>
          </View>
          <View className="flex-row items-center rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-stone-100">
            <Ionicons name="people-outline" size={14} color="#064e3b" />
            <Text
              className="ml-1.5 text-xs text-stone-700"
              style={{ fontFamily: 'Outfit_500Medium' }}>
              {recipe.servings} kişilik
            </Text>
          </View>
          <View className="flex-row items-center rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-stone-100">
            <Ionicons name="time-outline" size={14} color="#064e3b" />
            <Text
              className="ml-1.5 text-xs text-stone-700"
              style={{ fontFamily: 'Outfit_500Medium' }}>
              {recipe.time_min} dk
            </Text>
          </View>
          <View className="flex-row items-center rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-stone-100">
            <Ionicons name="speedometer-outline" size={14} color="#064e3b" />
            <Text
              className="ml-1.5 text-xs text-stone-700"
              style={{ fontFamily: 'Outfit_500Medium' }}>
              Zorluk: {recipe.difficulty}
            </Text>
          </View>
          <View className="flex-row items-center rounded-full bg-amber-500 px-3 py-1.5">
            <Ionicons name="checkmark-circle-outline" size={14} color="white" />
            <Text className="ml-1.5 text-xs text-white" style={{ fontFamily: 'Outfit_500Medium' }}>
              %{recipe.match_pct} uyum
            </Text>
          </View>
        </View>

        <View className="mt-5 flex-row gap-3">
          <View className="flex-1 items-center rounded-2xl bg-white py-4 shadow-sm ring-1 ring-stone-100">
            <Text className="text-lg text-stone-900" style={{ fontFamily: 'Outfit_600SemiBold' }}>
              {recipe.macros.protein}g
            </Text>
            <Text className="mt-1 text-xs text-stone-500" style={{ fontFamily: 'Outfit_400Regular' }}>
              Protein
            </Text>
          </View>
          <View className="flex-1 items-center rounded-2xl bg-white py-4 shadow-sm ring-1 ring-stone-100">
            <Text className="text-lg text-stone-900" style={{ fontFamily: 'Outfit_600SemiBold' }}>
              {recipe.macros.karb}g
            </Text>
            <Text className="mt-1 text-xs text-stone-500" style={{ fontFamily: 'Outfit_400Regular' }}>
              Karbonhidrat
            </Text>
          </View>
          <View className="flex-1 items-center rounded-2xl bg-white py-4 shadow-sm ring-1 ring-stone-100">
            <Text className="text-lg text-stone-900" style={{ fontFamily: 'Outfit_600SemiBold' }}>
              {recipe.macros.yag}g
            </Text>
            <Text className="mt-1 text-xs text-stone-500" style={{ fontFamily: 'Outfit_400Regular' }}>
              Yağ
            </Text>
          </View>
        </View>

        <View className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <Text
            className="text-lg text-stone-900"
            style={{ fontFamily: 'Fraunces_600SemiBold' }}>
            Malzemeler
          </Text>
          <View className="mt-3">
            {recipe.ingredients.map((ingredient, index) => (
              <View
                key={`${ingredient.name}-${index}`}
                className="flex-row items-start py-1.5">
                <View className="mt-2 mr-3 h-1.5 w-1.5 rounded-full bg-emerald-900" />
                <Text
                  className="flex-1 text-sm text-stone-700"
                  style={{ fontFamily: 'Outfit_400Regular' }}>
                  {ingredient.name}
                </Text>
                {!ingredient.in_inventory && (
                  <View className="ml-2 flex-row items-center rounded-full bg-amber-50 px-2 py-0.5 ring-1 ring-amber-200">
                    <Ionicons name="basket-outline" size={12} color="#f59e0b" />
                    <Text
                      className="ml-1 text-xs text-amber-900"
                      style={{ fontFamily: 'Outfit_500Medium' }}>
                      eksik
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <View className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <Text
            className="text-lg text-stone-900"
            style={{ fontFamily: 'Fraunces_600SemiBold' }}>
            Hazırlanışı
          </Text>
          <View className="mt-3">
            {recipe.steps.map((step, index) => (
              <View key={`${step}-${index}`} className="flex-row items-start py-2">
                <View className="mr-3 h-6 w-6 items-center justify-center rounded-full bg-emerald-900">
                  <Text
                    className="text-xs text-white"
                    style={{ fontFamily: 'Outfit_600SemiBold' }}>
                    {index + 1}
                  </Text>
                </View>
                <Text
                  className="flex-1 pt-0.5 text-sm text-stone-700"
                  style={{ fontFamily: 'Outfit_400Regular' }}>
                  {step}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="mt-4 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <View className="flex-row items-center">
            <Ionicons name="bulb-outline" size={18} color="#b45309" />
            <Text
              className="ml-2 text-lg text-amber-900"
              style={{ fontFamily: 'Fraunces_600SemiBold' }}>
              Şef Tüyosu
            </Text>
          </View>
          <Text
            className="mt-2 text-sm text-amber-900"
            style={{ fontFamily: 'Outfit_400Regular' }}>
            {recipe.chef_tip}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
