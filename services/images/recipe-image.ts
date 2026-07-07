// Tarif kartları/detayı için Gemini ile AI görsel üretimi.
//
// Bu modül `services/vision/`'dan TAMAMEN bağımsızdır — envanter çıkarım
// hattıyla hiçbir ortak kod/sağlayıcı seçimi mekanizması paylaşmaz; yalnızca
// aynı API anahtarını (EXPO_PUBLIC_GOOGLE_API_KEY) kullanır.
//
// Maliyet/gecikme kuralları (SKILL.md):
// - Görseller LAZY üretilir: kartlar mount oldukça tek tek kuyruğa girer,
//   kuyruk SIRAYLA (aynı anda tek istek) işler; üretilene kadar UI'da
//   emoji'li placeholder kalır.
// - Üretilen görsel FileSystem cache'ine TARİF ADIYLA yazılır; aynı tarif
//   adı için görsel bir daha ÜRETİLMEZ (envanter değişse bile cache'ten gelir).
// - Listede küçültülmüş kopya (thumbnail), detayda orijinal gösterilir;
//   thumbnail üretimi başarısız olursa orijinale düşülür (non-fatal).

import { GoogleGenAI } from '@google/genai';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Görsel üretim modeli — vision tarafının modellerinden ayrı bir ailedir
 * (metin/vision modelleri görsel ÜRETEMEZ). Varsayılan: Nano Banana 2 Lite
 * (`gemini-3.1-flash-lite-image`) — güncel görsel üretim modellerinin en
 * hızlısı/ucuzu; tarif kartı görseli için kalite yeterli.
 */
const IMAGE_MODEL = process.env.EXPO_PUBLIC_GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-lite-image';

const THUMBNAIL_WIDTH = 320;
const CACHE_DIR_NAME = 'recipe-images';
const LOG_TAG = '[recipe-image]';

export class RecipeImageError extends Error {}

export interface RecipeImageUris {
  /** Orijinal (4:3) görselin dosya URI'si — detay ekranında gösterilir. */
  originalUri: string;
  /** Küçültülmüş kopyanın dosya URI'si — liste kartında gösterilir. */
  thumbnailUri: string;
}

/**
 * Tarif adını dosya adı olarak güvenli, deterministik bir cache anahtarına
 * çevirir (Türkçe karakterler sadeleştirilir + çakışmaya karşı kısa hash).
 */
function cacheKey(recipeName: string): string {
  const normalized = recipeName.trim().toLowerCase();
  const slug = normalized
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) >>> 0;
  }
  return `${slug}-${hash.toString(16)}`;
}

function cacheDir(): Directory {
  return new Directory(Paths.cache, CACHE_DIR_NAME);
}

function originalFile(recipeName: string): File {
  return new File(cacheDir(), `${cacheKey(recipeName)}.jpg`);
}

function thumbnailFile(recipeName: string): File {
  return new File(cacheDir(), `${cacheKey(recipeName)}-thumb.jpg`);
}

/**
 * Cache'te hazır görsel varsa URI'lerini döndürür, yoksa null — senkron
 * olduğu için kart ilk render'da placeholder mı görsel mi göstereceğine
 * API çağrısı olmadan karar verebilir. Thumbnail eksikse (eski/yarım cache)
 * orijinal her iki amaç için de kullanılır.
 */
export function getCachedRecipeImage(recipeName: string): RecipeImageUris | null {
  const original = originalFile(recipeName);
  if (!original.exists) {
    return null;
  }
  const thumbnail = thumbnailFile(recipeName);
  console.log(`${LOG_TAG} cache HIT (API çağrısı yok): "${recipeName}"`);
  return {
    originalUri: original.uri,
    thumbnailUri: thumbnail.exists ? thumbnail.uri : original.uri,
  };
}

/**
 * Base64 metnini JS tarafında byte dizisine çevirir. Dosyaya yazarken
 * `write(base64, { encoding: 'base64' })` KULLANILMIYOR çünkü bu seçeneğin
 * native desteği expo-file-system 19.0.16'da eklendi — Expo Go'nun gömülü
 * native modülü daha eski olabilir (node_modules'taki JS sürümünden
 * bağımsızdır) ve eski native'de bu çağrı ya patlar ya base64 metnini düz
 * UTF-8 yazar. `Uint8Array` overload'ı ise yeni FS API'sinin ilk gününden
 * beri var — sürüm farkından etkilenmez.
 */
const B64_LOOKUP = (() => {
  const table = new Int8Array(128).fill(-1);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < alphabet.length; i++) {
    table[alphabet.charCodeAt(i)] = i;
  }
  return table;
})();

function base64ToBytes(base64: string): Uint8Array {
  const out = new Uint8Array(Math.floor((base64.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let idx = 0;
  for (let i = 0; i < base64.length; i++) {
    const code = base64.charCodeAt(i);
    const value = code < 128 ? B64_LOOKUP[code] : -1;
    if (value < 0) {
      continue; // '=' padding'i ve olası satır sonları atlanır
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[idx++] = (buffer >> bits) & 0xff;
    }
  }
  return idx === out.length ? out : out.slice(0, idx);
}

/**
 * Kullanıcının test edip beğendiği prompt şablonu. `dishDescription`
 * Claude'un tarifle birlikte doldurduğu `image_prompt_en`'den gelir
 * (yemek tanımı + tabaklama cümlesi); o yoksa tarif adı + malzeme
 * özetinden basit birleştirmeyle üretilir — AYRI bir LLM çağrısı yapılmaz.
 */
function buildImagePrompt(dishDescription: string): string {
  return (
    `Appetizing ${dishDescription} ` +
    'Clean food photography, bright studio lighting, white background, ' +
    'simple, high contrast, mobile app banner, 4:3 aspect ratio.'
  );
}

async function callGeminiForImage(prompt: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
  if (!apiKey) {
    throw new RecipeImageError(
      'EXPO_PUBLIC_GOOGLE_API_KEY tanımlı değil (.env dosyasını kontrol edin)'
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: { imageConfig: { aspectRatio: '4:3' } },
  });

  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return part.inlineData.data;
      }
    }
  }

  // Görsel yoksa teşhis için yanıtın metin/finishReason kısmını logla.
  const finishReason = response.candidates?.[0]?.finishReason;
  const text = response.text?.slice(0, 200);
  console.error(
    `${LOG_TAG} API görsel DÖNDÜRMEDİ — finishReason=${String(finishReason)}, text="${text ?? ''}"`
  );
  throw new RecipeImageError('Gemini yanıtında görsel bulunamadı');
}

/**
 * Tek bir tarif görseli üretir, orijinal + thumbnail'i cache'e yazar.
 * Cache kontrolünü ATLAMAZ — dışarıdan doğrudan çağrılsa bile aynı tarif
 * için ikinci kez üretim yapmaz. Her aşama loglanır (teşhis için).
 */
export async function generateRecipeImage(
  recipeName: string,
  ingredientsSummary: string,
  imagePromptEn?: string
): Promise<RecipeImageUris> {
  const cached = getCachedRecipeImage(recipeName);
  if (cached) {
    return cached;
  }

  const dishDescription =
    imagePromptEn && imagePromptEn.trim().length > 0
      ? `${imagePromptEn.trim().replace(/\.?$/, '.')}`
      : `${recipeName}, a Turkish home-style dish made with ${ingredientsSummary}. Served on a simple white plate.`;

  console.log(`${LOG_TAG} üretim BAŞLADI: "${recipeName}" (model=${IMAGE_MODEL})`);
  const startedAt = Date.now();
  const base64 = await callGeminiForImage(buildImagePrompt(dishDescription));
  console.log(
    `${LOG_TAG} API yanıtı OK: "${recipeName}" — ${((Date.now() - startedAt) / 1000).toFixed(1)}s, ` +
      `~${Math.round((base64.length * 3) / 4 / 1024)} KB`
  );

  const dir = cacheDir();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  const original = originalFile(recipeName);
  original.write(base64ToBytes(base64));
  console.log(`${LOG_TAG} orijinal yazıldı: ${original.uri}`);

  // Liste kartı için küçültülmüş kopya. Non-fatal: thumbnail üretimi
  // başarısız olursa görselden mahrum kalmak yerine kartta da orijinal
  // gösterilir (bir sonraki cache okuması da aynı şekilde davranır).
  let thumbnailUri = original.uri;
  try {
    const context = ImageManipulator.manipulate(original.uri).resize({ width: THUMBNAIL_WIDTH });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    const thumbnail = thumbnailFile(recipeName);
    new File(saved.uri).move(thumbnail);
    thumbnailUri = thumbnail.uri;
    console.log(`${LOG_TAG} thumbnail yazıldı: ${thumbnail.uri}`);
  } catch (error) {
    console.error(
      `${LOG_TAG} thumbnail üretilemedi ("${recipeName}"), kartta orijinal kullanılacak:`,
      error
    );
  }

  return { originalUri: original.uri, thumbnailUri };
}

// --- Lazy üretim kuyruğu -----------------------------------------------
// Kartlar mount oldukça istek buraya düşer; istekler AYNI ANDA DEĞİL,
// sırayla işlenir (9 kartın birden API'ye yüklenmesini engeller). Aynı
// tarif için bekleyen/süren istek varsa ikinci kez kuyruğa girmez.

const inFlight = new Map<string, Promise<RecipeImageUris>>();
let queueTail: Promise<unknown> = Promise.resolve();

export function enqueueRecipeImage(
  recipeName: string,
  ingredientsSummary: string,
  imagePromptEn?: string
): Promise<RecipeImageUris> {
  const key = cacheKey(recipeName);

  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

  console.log(`${LOG_TAG} kuyruğa eklendi: "${recipeName}"`);
  const task = queueTail
    .catch(() => {
      // Önceki kuyruk öğesinin hatası bu öğeyi etkilemesin.
    })
    .then(() => generateRecipeImage(recipeName, ingredientsSummary, imagePromptEn));

  queueTail = task.catch(() => {});
  inFlight.set(key, task);
  task.catch((error) => {
    // Hata SESSİZCE YUTULMAZ: tam mesaj + aşama loglanır; kayıt düşürülür
    // ki kart yeniden mount olduğunda tekrar denenebilsin.
    console.error(`${LOG_TAG} üretim BAŞARISIZ: "${recipeName}" —`, error);
    inFlight.delete(key);
  });

  return task;
}
