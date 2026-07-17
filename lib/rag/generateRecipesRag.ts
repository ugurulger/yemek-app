/**
 * RAG tabanlı tarif üretimi — CLIENT tarafı (BLOK A / A6, feature flag).
 *
 * `EXPO_PUBLIC_USE_RAG=true` iken Tarifler ekranı, mevcut iki aşamalı Claude
 * akışı (lib/claude/generateRecipes.ts — DEĞİŞTİRİLMEDİ) yerine Supabase
 * `generate-recipe` edge function'ını çağırır. API anahtarları edge
 * function'ın environment'ında yaşar; client yalnızca Supabase URL + anon
 * key kullanır (bkz. README-rag.md).
 *
 * Bu akış tek çağrıda final listeyi döndürür — mevcut akışın canlı/slot
 * gösterim callback'leri (onPlanReady/onDetailSettled) kullanılmaz; ekran
 * genel iskelet kartlarında bekleyip sonucu tek seferde basar.
 */
import { PREFERENCE_SECTIONS } from '@/types/preferences';

import { mergeRecipeLayers, RecipeGenerationError } from '@/lib/claude/generateRecipes';

import type { InventoryItem } from '@/types/inventory';
import type { RecipePreferences } from '@/types/preferences';
import type { Recipe } from '@/types/recipe';

/** Feature flag (A6): mevcut akış varsayılan — RAG bilinçli olarak açılmalı. */
export const RAG_ENABLED = process.env.EXPO_PUBLIC_USE_RAG === 'true';

/**
 * LLM çıktı dili. Uygulama şu an Türkçe; i18n dönüşümünde (BLOK B) bu değer
 * aktif uygulama dilinden okunacak. Edge function'ın kendi varsayılanı
 * English'tir — client mevcut UI diliyle tutarlı olsun diye açıkça yollar.
 */
const OUTPUT_LANGUAGE = 'Turkish';

const RECIPE_COUNT = 6;

export interface GenerateRecipesRagOptions {
  preferences: RecipePreferences;
  activePantryNames: string[];
  /** Kişi sayısı — verilmezse model tarif başına makul bir servings seçer. */
  servings?: number;
}

interface RagResponse {
  source?: 'database' | 'llm';
  recipes?: Recipe[];
  error?: string;
}

/** Tercih kategorilerindeki seçili chip'leri düz tag listesine indirger. */
function flattenPreferences(preferences: RecipePreferences): string[] {
  return PREFERENCE_SECTIONS.flatMap((section) => preferences[section.id] ?? []);
}

export async function generateRecipesRag(
  inventory: InventoryItem[],
  options: GenerateRecipesRagOptions
): Promise<Recipe[]> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new RecipeGenerationError(
      'RAG akışı için EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı (.env)'
    );
  }
  if (inventory.length === 0) {
    throw new RecipeGenerationError('Tarif önermek için envanterde ürün olmalı');
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-recipe`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        inventory: inventory.map((item) => ({ name: item.name, qty: item.qty, unit: item.unit })),
        preferences: flattenPreferences(options.preferences),
        pantry: options.activePantryNames,
        servings: options.servings,
        language: OUTPUT_LANGUAGE,
        count: RECIPE_COUNT,
      }),
    });
  } catch (cause) {
    throw new RecipeGenerationError('Tarif servisine bağlanılamadı', { cause });
  }

  let data: RagResponse;
  try {
    data = (await response.json()) as RagResponse;
  } catch (cause) {
    throw new RecipeGenerationError('Tarif servisi yanıtı ayrıştırılamadı', { cause });
  }

  if (!response.ok) {
    throw new RecipeGenerationError(
      `Tarif servisi hatası (${response.status}): ${data.error ?? 'bilinmeyen hata'}`
    );
  }
  if (!Array.isArray(data.recipes) || data.recipes.length === 0) {
    throw new RecipeGenerationError('Tarif üretilemedi, tekrar deneyin');
  }

  // Edge function uygulamanın Recipe şemasını döndürür; isim bazlı
  // tekilleştirme + missing_count artan sıralama mevcut akışla aynı.
  return mergeRecipeLayers([data.recipes]);
}
