// React Native ortamında @anthropic-ai/sdk kullanılamıyor (SDK, Metro'nun
// çözemediği Node yerleşik modüllerini `node:fs` gibi import ediyor). Bunun
// yerine Anthropic Messages API'sini RN'in yerleşik `fetch`'iyle doğrudan
// çağırıyoruz — hiçbir Node bağımlılığı yok.

import { buildObservationPrompt, parseInventoryItems, STRUCTURING_SYSTEM_PROMPT } from './prompt';
import {
  InventoryVisionError,
  type ExtractInventoryOptions,
  type InventoryItem,
  type VisionProvider,
} from './types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// İki aşamalı akış (paylaşılan promptlar için bkz. `./prompt.ts`). Aşama 1
// vision + yüksek çözünürlük gerektirdiği için Sonnet 5 (2576px'e kadar
// destekler, bkz. lib/media/resizeImageToBase64.ts); Aşama 2 saf metin→JSON
// dönüştürme olduğu için ucuz Haiku 4.5 yeterli.
const OBSERVATION_MODEL = 'claude-sonnet-5';
const STRUCTURING_MODEL = 'claude-haiku-4-5';
const OBSERVATION_MAX_TOKENS = 8192;
const STRUCTURING_MAX_TOKENS = 2048;

type ClaudeContentBlock =
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } }
  | { type: 'text'; text: string };

interface ClaudeCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callClaudeMessages(
  model: string,
  maxTokens: number,
  systemPrompt: string,
  userContent: ClaudeContentBlock[],
  disableThinking = false
): Promise<ClaudeCallResult> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
  }

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        // Tarayıcı ortamlarında (Expo web) doğrudan erişimi açar; native'de zararsız.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        // Claude Sonnet 5'te thinking belirtilmezse varsayılan olarak adaptive
        // (açık) çalışır. Gözlem aşaması akıl yürütmeden çok direkt gözlem
        // gerektirdiği için ve adaptive thinking MVP-3 ölçümünde yanıt
        // süresinin başlıca kaynağıydı (bkz. SKILL.md — 58s), burada
        // kapatılabiliyor (bkz. `disableThinking` parametresi).
        ...(disableThinking ? { thinking: { type: 'disabled' } } : {}),
        // Sistem talimatı sabit olduğu için cache_control: ephemeral ile
        // işaretlenir (maliyet kuralı, bkz. SKILL.md). Talimat metinleri kısa
        // kalırsa cache modelin token eşiğinin altında kalıp sessizce devre
        // dışı kalabilir — hata vermez (Anthropic dokümantasyonu).
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    });
  } catch (cause) {
    throw new Error('Claude API bağlantısı kurulamadı', { cause });
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      // yanıt gövdesi okunamadıysa yalnızca durum kodunu bildir
    }
    throw new Error(`Claude API hatası (${response.status}): ${detail.slice(0, 200)}`);
  }

  const data: unknown = await response.json();
  const dataObj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};

  const content = dataObj.content;
  const textBlock = Array.isArray(content)
    ? (content.find(
        (block) =>
          typeof block === 'object' &&
          block !== null &&
          (block as { type?: unknown }).type === 'text'
      ) as { text?: unknown } | undefined)
    : undefined;

  if (!textBlock || typeof textBlock.text !== 'string') {
    throw new Error('Claude yanıtında metin bulunamadı');
  }

  const usage =
    typeof dataObj.usage === 'object' && dataObj.usage !== null
      ? (dataObj.usage as Record<string, unknown>)
      : {};
  const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
  const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;

  return { text: textBlock.text, inputTokens, outputTokens };
}

async function runObservationStage(
  images: string[],
  onUsage?: ExtractInventoryOptions['onUsage']
): Promise<string> {
  const imageBlocks: ClaudeContentBlock[] = images.map((data) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data },
  }));

  const result = await callClaudeMessages(
    OBSERVATION_MODEL,
    OBSERVATION_MAX_TOKENS,
    buildObservationPrompt(images.length),
    [...imageBlocks, { type: 'text', text: 'Görüntülerdeki/karelerdeki ürünleri detaylıca anlat.' }],
    /* disableThinking */ true
  );

  onUsage?.({
    stage: 'observation',
    model: OBSERVATION_MODEL,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return result.text;
}

async function runStructuringStage(
  observationText: string,
  onUsage?: ExtractInventoryOptions['onUsage']
): Promise<string> {
  const result = await callClaudeMessages(STRUCTURING_MODEL, STRUCTURING_MAX_TOKENS, STRUCTURING_SYSTEM_PROMPT, [
    { type: 'text', text: observationText },
  ]);

  onUsage?.({
    stage: 'structuring',
    model: STRUCTURING_MODEL,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return result.text;
}

async function extractInventory(
  images: string[],
  options?: ExtractInventoryOptions
): Promise<InventoryItem[]> {
  if (images.length === 0) {
    throw new InventoryVisionError('Çıkarım için en az bir görüntü gerekli');
  }

  let observationText: string;
  try {
    observationText = await runObservationStage(images, options?.onUsage);
  } catch (error) {
    if (error instanceof InventoryVisionError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new InventoryVisionError(`Claude gözlem aşaması başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  // DEBUG: yapılandırma aşamasına gitmeden önce ham gözlem metnini bildir
  // (bkz. SKILL.md "Debug: Aşama 1 ham metnini gör").
  options?.onObservation?.(observationText);

  let structuredText: string;
  try {
    structuredText = await runStructuringStage(observationText, options?.onUsage);
  } catch (error) {
    if (error instanceof InventoryVisionError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new InventoryVisionError(`Claude yapılandırma aşaması başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  return parseInventoryItems(structuredText);
}

export const claudeVisionProvider: VisionProvider = { extractInventory };
