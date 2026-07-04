// React Native ortamında @anthropic-ai/sdk kullanılamıyor (SDK, Metro'nun
// çözemediği Node yerleşik modüllerini `node:fs` gibi import ediyor). Bunun
// yerine Anthropic Messages API'sini RN'in yerleşik `fetch`'iyle doğrudan
// çağırıyoruz — hiçbir Node bağımlılığı yok.

import { buildSystemPrompt, parseInventoryItems } from './prompt';
import { InventoryVisionError, type InventoryItem, type VisionProvider } from './types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;

async function callClaude(images: string[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
  }

  const imageBlocks = images.map((data) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/jpeg' as const,
      data,
    },
  }));

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
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Sistem talimatı sabit olduğu için cache_control: ephemeral ile
        // işaretlenir (maliyet kuralı, bkz. SKILL.md). Not: Bu talimat metni
        // kısa olduğundan Claude Sonnet'in prompt caching için gereken 1024
        // token eşiğinin altında kalabilir — bu durumda cache sessizce devre
        // dışı kalır, hata vermez (Anthropic dokümantasyonu). Talimat metni
        // büyürse (örn. çoklu kare kuralı eklenince) eşiği aşıp fiilen
        // önbelleklenmeye başlayabilir.
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
            content: [
              ...imageBlocks,
              {
                type: 'text',
                text: 'Görüntülerdeki ürünleri JSON olarak çıkar.',
              },
            ],
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
  const content =
    typeof data === 'object' && data !== null
      ? (data as { content?: unknown }).content
      : undefined;

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

  return textBlock.text;
}

async function extractInventory(images: string[]): Promise<InventoryItem[]> {
  if (images.length === 0) {
    throw new InventoryVisionError('Çıkarım için en az bir görüntü gerekli');
  }

  const systemPrompt = buildSystemPrompt(images.length);

  let responseText: string;
  try {
    responseText = await callClaude(images, systemPrompt);
  } catch (error) {
    if (error instanceof InventoryVisionError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new InventoryVisionError(`Claude API çağrısı başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  return parseInventoryItems(responseText);
}

export const claudeVisionProvider: VisionProvider = { extractInventory };
