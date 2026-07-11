import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import RecipeList from '@/components/recipes/RecipeList';
import RecipeLayerSections, {
  type RecipeCardSlot,
  type RecipeDisplaySection,
} from '@/components/recipes/RecipeLayerSections';
import RecipeSkeletonCard from '@/components/recipes/RecipeSkeletonCard';
import {
  generateRecipeDetail,
  generateRecipesTwoPhase,
  mergeRecipeLayers,
  RecipeGenerationError,
  type RecipeLayerId,
} from '@/lib/claude/generateRecipes';
import { useInventoryStore } from '@/store/inventoryStore';
import { inventoryFingerprint, useRecipeStore } from '@/store/recipeStore';
import type { Recipe } from '@/types/recipe';

const PLANNED_RECIPE_COUNT = 6;

interface RecipeSlotState {
  name: string;
  /** Aşama 1'in hedefi — detay çağrısının varyantını ve ön bölüm yerleşimini belirler. */
  estimatedLayer: RecipeLayerId;
  status: 'loading' | 'done' | 'error';
  recipe: Recipe | null;
  /** Aşama 2 dönünce eksik malzeme sayısından KODDA hesaplanan kesin katman — bkz. `assignRecipeLayer`. */
  actualLayer: RecipeLayerId | null;
}

function layerForSlot(slot: RecipeSlotState): RecipeLayerId | null {
  return slot.status === 'done' ? slot.actualLayer : slot.estimatedLayer;
}

/** Alışveriş bölümü sıralaması: dolan kartlar gerçek eksik sayısına göre,
 * yüklenenler tahmini katmanlarına göre kaba sıraya girer (stable sort —
 * eşitlikte plan sırası korunur). */
function shoppingSortKey(slot: RecipeSlotState): number {
  if (slot.status === 'done' && slot.recipe) return slot.recipe.missing_count;
  return slot.estimatedLayer === 'closeMatch' ? 1.5 : 3.5;
}

export default function TariflerScreen() {
  const inventoryItems = useInventoryStore((state) => state.items);
  const recipes = useRecipeStore((state) => state.recipes);
  const setRecipes = useRecipeStore((state) => state.setRecipes);
  const generatedForFingerprint = useRecipeStore((state) => state.generatedForFingerprint);

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slots, setSlots] = useState<RecipeSlotState[]>([]);

  async function handleGenerateRecipes() {
    // Önbellek kuralı: envanter değişmediyse tarifler yeniden üretilmez,
    // AsyncStorage'dan hidrate edilen mevcut (iki aşamalı üretimin birleşmiş)
    // liste kullanılmaya devam eder.
    const fingerprint = inventoryFingerprint(inventoryItems);
    if (recipes.length > 0 && generatedForFingerprint === fingerprint) {
      setErrorMessage(null);
      return;
    }

    setErrorMessage(null);
    setSlots([]);
    setIsGenerating(true);
    try {
      const merged = await generateRecipesTwoPhase(inventoryItems, {
        // Aşama 1 (isim/plan) döner dönmez 9 slot oluşturulur — her biri
        // isim + tahmini katmanla birlikte "detay yükleniyor" durumunda başlar.
        onPlanReady: (plans) => {
          setSlots(
            plans.map((plan) => ({
              name: plan.name,
              estimatedLayer: plan.estimatedLayer,
              status: 'loading',
              recipe: null,
              actualLayer: null,
            }))
          );
        },
        // Her detay TAMAMLANDIĞI ANDA (diğerlerini beklemeden) o slot tek
        // başına güncellenir — kartlar tek tek dolar (canlı akış hissi).
        onDetailSettled: (result) => {
          setSlots((prev) =>
            prev.map((slot, index) =>
              index === result.planIndex
                ? {
                    ...slot,
                    status: result.status,
                    recipe: result.recipe ?? null,
                    actualLayer: result.layer ?? null,
                  }
                : slot
            )
          );
        },
      });
      setRecipes(merged, fingerprint);
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

  async function retrySlot(index: number) {
    const slot = slots[index];
    if (!slot) return;

    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, status: 'loading' } : s)));
    try {
      const { recipe, layer } = await generateRecipeDetail(slot.name, inventoryItems, slot.estimatedLayer);
      const nextSlots = slots.map((s, i) =>
        i === index ? { ...s, status: 'done' as const, recipe, actualLayer: layer } : s
      );
      setSlots(nextSlots);
      const doneRecipes = nextSlots
        .filter((s) => s.status === 'done' && s.actualLayer !== null && s.recipe)
        .map((s) => s.recipe as Recipe);
      const merged = mergeRecipeLayers([doneRecipes]);
      if (merged.length > 0) {
        setRecipes(merged, inventoryFingerprint(inventoryItems));
      }
    } catch {
      setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, status: 'error' } : s)));
    }
  }

  const hasInventory = inventoryItems.length > 0;
  const hasRecipes = recipes.length > 0;
  // Aşama 1 henüz dönmedi: slot yok, sadece isimsiz genel iskeletler gösterilir.
  const isPlanning = isGenerating && slots.length === 0;

  const cardSlots: RecipeCardSlot[] = slots.map((slot, index) => ({
    key: `slot-${index}`,
    name: slot.name,
    status: slot.status,
    recipe: slot.recipe,
    onRetry: () => retrySlot(index),
  }));

  const sections: RecipeDisplaySection[] = [
    {
      key: 'ready',
      title: 'Hemen Yapabilirsin',
      prominent: true,
      slots: cardSlots.filter((_, i) => layerForSlot(slots[i]) === 'ready'),
    },
    {
      key: 'shopping',
      title: 'Küçük Bir Alışverişle',
      prominent: false,
      slots: cardSlots
        .map((cardSlot, i) => ({ cardSlot, slot: slots[i] }))
        .filter(({ slot }) => {
          const layer = layerForSlot(slot);
          return layer === 'closeMatch' || layer === 'fewMissing';
        })
        .sort((a, b) => shoppingSortKey(a.slot) - shoppingSortKey(b.slot))
        .map(({ cardSlot }) => cardSlot),
    },
  ];

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

      {isPlanning ? (
        <View className="flex-1 px-5">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            {Array.from({ length: PLANNED_RECIPE_COUNT }).map((_, index) => (
              <View key={index} className="mb-2">
                <RecipeSkeletonCard />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : isGenerating ? (
        <View className="flex-1 px-5">
          <RecipeLayerSections sections={sections} onPressRecipe={(id) => router.push(`/recipe/${id}`)} />
        </View>
      ) : hasRecipes ? (
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
