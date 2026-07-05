import { GoogleGenAI } from '@google/genai';

import { buildObservationPrompt, parseInventoryItems, STRUCTURING_SYSTEM_PROMPT } from './prompt';
import {
  InventoryVisionError,
  type ExtractInventoryOptions,
  type InventoryItem,
  type VisionProvider,
} from './types';

// gemini-2.5-flash: hız/maliyet odaklı varsayılan, hem gözlem hem
// yapılandırma aşaması için kullanılır. Daha yüksek doğruluk gerekirse
// EXPO_PUBLIC_GEMINI_MODEL=gemini-2.5-pro ile değiştirilebilir.
const DEFAULT_MODEL = 'gemini-2.5-flash';

// DENEYSEL — native video girişi (bkz. SKILL.md "Debug/deneysel notlar").
// Varsayılan KAPALI: mevcut kare-tabanlı akış (expo-video-thumbnails ile
// çıkarılan kareler) production'da bozulmasın diye. Açıldığında kareler
// yerine ham video tek `inlineData` parçası olarak gönderilir.
const NATIVE_VIDEO_ENABLED = process.env.EXPO_PUBLIC_GEMINI_NATIVE_VIDEO === 'true';

// Gemini dokümantasyonu (ai.google.dev/gemini-api/docs/video-understanding):
// inline (base64) video < 100MB dosya VE < 1dk için önerilir; toplam istek
// boyutu 20MB'ı aşarsa Files API'ye geçilmesi öneriliyor (Files API burada
// UYGULANMADI — bu deneysel yol için kapsam dışı). Bu sınırı aşan videolar
// için API'ye hiç istek atmadan net bir hata veriyoruz.
const MAX_INLINE_VIDEO_BYTES = 20 * 1024 * 1024;

// NOT — Context caching: Gemini 2.5 modelleri "implicit caching"i (tekrar
// eden prefix'ler için otomatik, kod gerektirmeyen önbellekleme) varsayılan
// olarak açık sunuyor; bu iki aşamalı akışta her aşamanın kendi sabit
// sistem talimatı (bkz. `./prompt.ts`) tekrar gönderildiğinde otomatik
// devreye girer, ekstra kod gerekmiyor.
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (client) {
    return client;
  }
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_GOOGLE_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GeminiCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callGemini(
  model: string,
  systemPrompt: string,
  parts: GeminiPart[],
  jsonMode: boolean
): Promise<GeminiCallResult> {
  const ai = getClient();

  let responseText: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: systemPrompt,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    });
    responseText = response.text;
    inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
  } catch (cause) {
    throw new Error('Gemini API çağrısı başarısız oldu', { cause });
  }

  if (typeof responseText !== 'string' || responseText.length === 0) {
    throw new Error('Gemini yanıtında metin bulunamadı');
  }

  return { text: responseText, inputTokens, outputTokens };
}

// MVP-4: Claude'da (MVP-3) işe yarayan iki aşamalı yaklaşım Gemini'ye de
// uygulandı — kullanıcının kendi (kod dışı) Gemini testinde şemasız serbest
// promptla çok daha detaylı sonuç aldığı doğrulanmıştı; bizim önceki
// tek-aşamalı sıkı şema çağrımız bu kaliteyi yakalamıyordu.
async function runObservationStage(
  images: string[],
  model: string,
  onUsage?: ExtractInventoryOptions['onUsage']
): Promise<string> {
  const imageParts: GeminiPart[] = images.map((data) => ({
    inlineData: { mimeType: 'image/jpeg', data },
  }));

  const result = await callGemini(
    model,
    buildObservationPrompt(images.length),
    [...imageParts, { text: 'Görüntülerdeki/karelerdeki ürünleri detaylıca anlat.' }],
    false
  );

  onUsage?.({ stage: 'observation', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

  return result.text;
}

function estimateBase64ByteSize(base64: string): number {
  // Kaba ama yeterli tahmin: base64 4 karakter ≈ 3 bayt (padding'i ihmal eder).
  return Math.ceil((base64.length * 3) / 4);
}

// DENEYSEL: video karelerini çıkarıp göndermek yerine ham videoyu TEK
// `inlineData` parçası olarak Gemini'ye gönderir. buildObservationPrompt(1)
// kullanılır — "kareler aynı anın farklı halleri, tekilleştir" kuralı tek
// bir video parçası için anlamsız, Gemini videoyu zaten bütün olarak görür.
async function runObservationStageFromVideo(
  video: { data: string; mimeType: string },
  model: string,
  onUsage?: ExtractInventoryOptions['onUsage']
): Promise<string> {
  const byteSize = estimateBase64ByteSize(video.data);
  if (byteSize > MAX_INLINE_VIDEO_BYTES) {
    throw new InventoryVisionError(
      `Video çok büyük (~${(byteSize / (1024 * 1024)).toFixed(1)}MB) — Gemini'nin inline video ` +
        `girişi için önerilen sınır ~20MB. Daha kısa/küçük bir video deneyin, ya da ` +
        `EXPO_PUBLIC_GEMINI_NATIVE_VIDEO'yu kapatıp kare-tabanlı akışı kullanın.`
    );
  }

  const result = await callGemini(
    model,
    buildObservationPrompt(1),
    [{ inlineData: { mimeType: video.mimeType, data: video.data } }, { text: 'Videodaki ürünleri detaylıca anlat.' }],
    false
  );

  onUsage?.({ stage: 'observation', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

  return result.text;
}

async function runStructuringStage(
  observationText: string,
  model: string,
  onUsage?: ExtractInventoryOptions['onUsage']
): Promise<string> {
  const result = await callGemini(model, STRUCTURING_SYSTEM_PROMPT, [{ text: observationText }], true);

  onUsage?.({ stage: 'structuring', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

  return result.text;
}

async function extractInventory(
  images: string[],
  options?: ExtractInventoryOptions
): Promise<InventoryItem[]> {
  const video = NATIVE_VIDEO_ENABLED ? options?.video : undefined;

  if (video == null && images.length === 0) {
    throw new InventoryVisionError('Çıkarım için en az bir görüntü gerekli');
  }

  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || DEFAULT_MODEL;

  let observationText: string;
  try {
    observationText =
      video != null
        ? await runObservationStageFromVideo(video, model, options?.onUsage)
        : await runObservationStage(images, model, options?.onUsage);
  } catch (error) {
    if (error instanceof InventoryVisionError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new InventoryVisionError(`Gemini gözlem aşaması başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  // DEBUG: yapılandırma aşamasına gitmeden önce ham gözlem metnini bildir
  // (bkz. SKILL.md "Debug: Aşama 1 ham metnini gör").
  options?.onObservation?.(observationText);

  let structuredText: string;
  try {
    structuredText = await runStructuringStage(observationText, model, options?.onUsage);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new InventoryVisionError(`Gemini yapılandırma aşaması başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  return parseInventoryItems(structuredText);
}

export const geminiVisionProvider: VisionProvider = { extractInventory };
