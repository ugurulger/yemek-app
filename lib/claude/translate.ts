/**
 * Toplu çeviri yardımcıları (dil değişiminde "topyekün karşılığını koyma" +
 * envanter çıkarımı sonrası iki dilli ad üretimi için). Claude tool-use
 * şemasıyla çağrılır — çıktı sırası/uzunluğu girdiyle birebir aynı olmak
 * ZORUNDADIR, aksi halde TranslationError fırlatılır (çağıran taraf çeviriyi
 * sessizce atlayıp orijinal metinle devam edebilir — çeviri hiçbir akışta
 * kritik yol DEĞİLDİR).
 *
 * i18n'e BİLİNÇLİ olarak bağımlı değildir (lib modülleri Node script'lerinden
 * de import ediliyor — ekran sınırı kararı, BLOK B); hedef dil parametre olarak
 * gelir.
 */
import { callClaudeForToolInput } from './client';

import type { Recipe, RecipeTexts } from '@/types/recipe';

/**
 * Kısa ürün adı listeleri için ucuz model yeterli (İş 3a — envanter adları
 * TEK TOPLU haiku çağrısıyla çevrilir); tam tarif çevirisi (uzun serbest
 * metin, doğal akış önemli) sonnet'te kalır.
 */
const TEXTS_MODEL = 'claude-haiku-4-5';
const RECIPE_MODEL = 'claude-sonnet-4-6';
const TEXTS_MAX_TOKENS = 2048;
const RECIPE_MAX_TOKENS = 3072;
const SUBMIT_TRANSLATIONS_TOOL = 'submit_translations';
const SUBMIT_RECIPE_TRANSLATION_TOOL = 'submit_recipe_translation';

export type TranslationLanguage = 'Turkish' | 'English';

export class TranslationError extends Error {}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Kısa metin listesini (ör. envanter ürün adları) hedef dile çevirir.
 * Çıktı, girdiyle AYNI sıra ve uzunluktadır. Gıda/ürün adlarında market
 * rafında kullanılan doğal karşılık tercih edilir ("Küflü Peynir" ↔
 * "Blue Cheese" gibi) — birebir kelime çevirisi değil.
 */
export async function translateTexts(
  texts: string[],
  targetLanguage: TranslationLanguage
): Promise<string[]> {
  if (texts.length === 0) {
    return [];
  }

  let toolInput: Record<string, unknown>;
  try {
    toolInput = await callClaudeForToolInput({
      model: TEXTS_MODEL,
      max_tokens: TEXTS_MAX_TOKENS,
      temperature: 0,
      system: [
        {
          type: 'text',
          text:
            `Sana JSON dizisi olarak kısa ürün/malzeme adları verilecek. Her birini ${targetLanguage} diline çevir. ` +
            'Kurallar: gıda adlarında hedef dilde market rafında/mutfakta kullanılan DOĞAL karşılığı seç (birebir ' +
            'kelime çevirisi değil); zaten hedef dilde olan girdiyi olduğu gibi bırak; özel/marka adlarını çevirme; ' +
            'baş harf büyüklüğünü girdiye benzer tut. Çıktı girdiyle AYNI SIRADA ve AYNI UZUNLUKTA olmalı.',
        },
      ],
      messages: [{ role: 'user', content: JSON.stringify(texts) }],
      tools: [
        {
          name: SUBMIT_TRANSLATIONS_TOOL,
          description: 'Verilen metin listesinin hedef dildeki karşılıklarını aynı sırayla gönderir.',
          input_schema: {
            type: 'object',
            properties: {
              translations: {
                type: 'array',
                items: { type: 'string' },
                minItems: texts.length,
                maxItems: texts.length,
              },
            },
            required: ['translations'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: SUBMIT_TRANSLATIONS_TOOL },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new TranslationError(`Çeviri çağrısı başarısız oldu: ${message}`, { cause: error });
  }

  const translations = toolInput.translations;
  if (!isStringArray(translations) || translations.length !== texts.length) {
    throw new TranslationError('Çeviri yanıtı girdiyle eşleşmiyor');
  }
  return translations;
}

/**
 * TEK tarifin serbest metin alanlarını (ad, malzeme adları/birimleri, adımlar,
 * şef tüyosu) hedef dile çevirir. Sayısal/enum alanlar ÇEVRİLMEZ — çağıran
 * taraf dönen `RecipeTexts`'i orijinal tarifin üstüne bindirir (bkz.
 * src/i18n/recipeI18n.ts — localizeRecipe). `ingredients` ve `steps` orijinal
 * dizilerle aynı sıra/uzunlukta doğrulanır.
 */
export async function translateRecipeTexts(
  recipe: Recipe,
  targetLanguage: TranslationLanguage
): Promise<RecipeTexts> {
  const source = {
    name: recipe.name,
    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.name,
      unit: ingredient.unit,
    })),
    steps: recipe.steps,
    chef_tip: recipe.chef_tip,
  };

  let toolInput: Record<string, unknown>;
  try {
    toolInput = await callClaudeForToolInput({
      model: RECIPE_MODEL,
      max_tokens: RECIPE_MAX_TOKENS,
      temperature: 0,
      system: [
        {
          type: 'text',
          text:
            `Sana bir yemek tarifinin serbest metin alanları JSON olarak verilecek; hepsini ${targetLanguage} ` +
            'diline çevir. Kurallar: yemek/malzeme adlarında hedef dilde mutfakta kullanılan DOĞAL karşılığı seç; ' +
            'birimleri hedef dilin yaygın mutfak birimleriyle karşıla ("su bardağı" ↔ "cup", "yk" ↔ "tbsp" gibi; ' +
            'g/kg/ml/l aynen kalır); adım metinlerini akıcı ve doğal çevir, miktar/süre değerlerini DEĞİŞTİRME. ' +
            '"ingredients" ve "steps" girdiyle AYNI SIRADA ve AYNI UZUNLUKTA olmalı.',
        },
      ],
      messages: [{ role: 'user', content: JSON.stringify(source) }],
      tools: [
        {
          name: SUBMIT_RECIPE_TRANSLATION_TOOL,
          description: 'Tarifin serbest metin alanlarının hedef dildeki karşılığını gönderir.',
          input_schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              ingredients: {
                type: 'array',
                minItems: source.ingredients.length,
                maxItems: source.ingredients.length,
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    unit: { type: 'string' },
                  },
                  required: ['name', 'unit'],
                },
              },
              steps: {
                type: 'array',
                items: { type: 'string' },
                minItems: source.steps.length,
                maxItems: source.steps.length,
              },
              chef_tip: { type: 'string' },
            },
            required: ['name', 'ingredients', 'steps', 'chef_tip'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: SUBMIT_RECIPE_TRANSLATION_TOOL },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new TranslationError(`"${recipe.name}" tarif çevirisi başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  const { name, ingredients, steps, chef_tip: chefTip } = toolInput as Partial<RecipeTexts> & {
    chef_tip?: unknown;
  };

  const ingredientsValid =
    Array.isArray(ingredients) &&
    ingredients.length === recipe.ingredients.length &&
    ingredients.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { name?: unknown }).name === 'string' &&
        typeof (entry as { unit?: unknown }).unit === 'string'
    );

  if (
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    !ingredientsValid ||
    !isStringArray(steps) ||
    steps.length !== recipe.steps.length ||
    typeof chefTip !== 'string'
  ) {
    throw new TranslationError(`"${recipe.name}" tarif çevirisi girdiyle eşleşmiyor`);
  }

  return {
    name,
    ingredients: (ingredients as { name: string; unit: string }[]).map((entry) => ({
      name: entry.name,
      unit: entry.unit,
    })),
    steps,
    chef_tip: chefTip,
  };
}
