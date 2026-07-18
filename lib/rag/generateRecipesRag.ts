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
 *
 * DİL POLİTİKASI (kullanıcı kararı, 2026-07-18 — canlı ölçüm gerekçeli, bkz.
 * analysis/rag-analysis.md §7): RAG hattı UYGULAMA DİLİNDEN BAĞIMSIZ olarak
 * HER ZAMAN İngilizce çalışır — envanter adları nameEn, kiler adları statik
 * EN çeviri, edge function'a language: "English". Nedenler: korpus %100
 * İngilizce (retrieval isabeti EN sorguda belirgin yüksek), EN üretim ~%25
 * daha hızlı/ucuz ve Haiku'nun TR çıktısı pürüzlü. Türkçe gösterim, üretim
 * SONRASI mevcut çeviri katmanıyla yapılır (src/i18n/recipeI18n.ts —
 * ensureRecipeTranslations, ekran tetikler; çeviri gelene dek EN gösterilir).
 */
import { pantryPromptNames, type PantryNameFields } from '@/src/i18n/inventoryI18n';
import { PREFERENCE_SECTIONS } from '@/types/preferences';

import {
  applyInventoryReconciliation,
  mergeRecipeLayers,
  RecipeGenerationError,
  simplifyInventory,
} from '@/lib/claude/generateRecipes';
import { translateTexts } from '@/lib/claude/translate';

import type { InventoryItem } from '@/types/inventory';
import type { RecipePreferences } from '@/types/preferences';
import type { Recipe } from '@/types/recipe';

/** Feature flag (A6): mevcut akış varsayılan — RAG bilinçli olarak açılmalı. */
export const RAG_ENABLED = process.env.EXPO_PUBLIC_USE_RAG === 'true';

const RECIPE_COUNT = 6;

export interface GenerateRecipesRagOptions {
  preferences: RecipePreferences;
  /** Aktif kiler malzemeleri — adlar iki dilli alanlarla birlikte gelir ki
   * hep-İngilizce politikası kullanıcı eklemelerinde de uygulanabilsin. */
  activePantry: PantryNameFields[];
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

  // DİL POLİTİKASI (bkz. üstteki modül yorumu): retrieval sorgusu, kiler ve
  // üretim dili HER ZAMAN İngilizce — uygulama dili yalnızca üretim SONRASI
  // çeviri katmanını ilgilendirir.
  const language = 'en' as const;

  // EN karşılığı eksik envanter adları TEK toplu çağrıyla tamamlanır (açılış
  // backfill'i henüz koşmadıysa payload'a Türkçe ad sızıyor ve üretilen EN
  // tarifin içinde TR malzeme adları görünüyordu — canlı test gözlemi).
  // Çeviri başarısız olursa akış DÜŞMEZ, mevcut adlarla devam edilir; kalıcı
  // yazım açılış backfill'inin işi (burada store'a yazılmaz).
  let matchInventory = inventory;
  const missingEn = inventory.filter((item) => !item.nameEn);
  if (missingEn.length > 0) {
    try {
      const translations = await translateTexts(
        missingEn.map((item) => item.name),
        'English'
      );
      const byId = new Map(missingEn.map((item, index) => [item.id, translations[index]]));
      matchInventory = inventory.map((item) =>
        byId.has(item.id) ? { ...item, nameEn: byId.get(item.id) } : item
      );
    } catch (error) {
      console.warn('[rag] envanter EN ad tamamlama başarısız — mevcut adlarla devam:', error);
    }
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
        inventory: simplifyInventory(matchInventory, language),
        preferences: flattenPreferences(options.preferences),
        // Kiler adları İngilizce'ye çevrilir: varsayılanlar statik i18n
        // etiketiyle, kullanıcı eklemeleri nameEn alanıyla (Bulgu 1: TR kiler
        // adları hem sahte eksik üretiyor hem hibrit kısayolu bloke ediyordu).
        pantry: pantryPromptNames(options.activePantry, language),
        servings: options.servings,
        language: 'English',
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
  // Fine dining tarifleri (İş 1: category === 'fine-dining') bu sıralamaya
  // KARIŞTIRILMAZ — kendi bölümlerinde, listenin sonunda gösterilirler.
  // Tarifler HER ZAMAN language: 'en' damgasıyla saklanır; uygulama dili
  // Türkçe ise gösterim çevirisini EKRAN tetikler (recipes.tsx →
  // ensureRecipeTranslations — bkz. src/i18n/recipeI18n.ts; çeviri hazır
  // olana dek İngilizce gösterilir, hazır olunca UI kendiliğinden yenilenir).
  // Deterministik emniyet katmanı (İş 3b) burada da uygulanır: envanterle
  // eşleşen malzemeler in_inventory: true + envanterdeki EN adıyla döner.
  const withLanguage = data.recipes.map((recipe) =>
    applyInventoryReconciliation({ ...recipe, language }, matchInventory, language)
  );
  const fineDining = withLanguage.filter((recipe) => recipe.category === 'fine-dining');
  const normal = withLanguage.filter((recipe) => recipe.category !== 'fine-dining');
  return [...mergeRecipeLayers([normal]), ...fineDining];
}
