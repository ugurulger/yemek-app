import { callClaudeForText } from './client';

import type {
  InventoryConfidence,
  InventoryItem,
  InventoryUnit,
} from '@/types/inventory';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;

const VALID_UNITS: InventoryUnit[] = ['adet', 'g', 'kg', 'ml', 'l', 'demet'];
const VALID_CONFIDENCES: InventoryConfidence[] = ['high', 'low'];

const BASE_SYSTEM_PROMPT =
  'Fiş fotoğrafı veya buzdolabı görüntülerinden ürünleri çıkar. SADECE JSON dön: ' +
  '[{ "name": string, "qty": number, "unit": "adet|g|kg|ml|l|demet", "emoji": string, "confidence": "high|low" }]. ' +
  'Markdown backtick yok, açıklama yok.';

const MULTI_FRAME_SYSTEM_PROMPT_SUFFIX =
  ' Gönderilen görüntüler aynı buzdolabının/mutfağın farklı anlarına ait kareler. ' +
  'Aynı ürünü birden fazla karede görüyorsan TEKİLLEŞTİR — tek bir kayıt olarak dön, ' +
  'miktarı en güvenilir kareye göre belirle.';

/**
 * Fotoğraf/görüntülerden Claude vision API ile envanter çıkarımı sırasında
 * oluşan hatalar için kullanılan hata tipi. Çağıran taraf bu tek hata
 * tipini yakalayarak kullanıcıya "tekrar dene" durumu gösterebilir.
 */
export class InventoryVisionError extends Error {}

function generateId(): string {
  // React Native'de crypto.randomUUID her zaman mevcut olmayabilir.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Bazı yanıtlar sadece açılış fence'i içerebilir ya da fence'siz gelebilir;
  // genel bir temizlik olarak baştaki/sondaki backtick bloklarını da temizle.
  return trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
}

function isValidUnit(value: unknown): value is InventoryUnit {
  return typeof value === 'string' && (VALID_UNITS as string[]).includes(value);
}

function isValidConfidence(value: unknown): value is InventoryConfidence {
  return typeof value === 'string' && (VALID_CONFIDENCES as string[]).includes(value);
}

function toInventoryItem(raw: unknown): InventoryItem | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const name = obj.name;
  const qty = obj.qty;
  const unit = obj.unit;
  const emoji = obj.emoji;
  const confidence = obj.confidence;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return null;
  }
  if (typeof qty !== 'number' || !Number.isFinite(qty)) {
    return null;
  }
  if (!isValidUnit(unit)) {
    return null;
  }

  return {
    id: generateId(),
    name,
    qty,
    unit,
    emoji: typeof emoji === 'string' && emoji.length > 0 ? emoji : '🍽️',
    confidence: isValidConfidence(confidence) ? confidence : 'high',
  };
}

function parseInventoryItems(responseText: string): InventoryItem[] {
  const cleaned = stripMarkdownFence(responseText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (cause) {
    throw new InventoryVisionError('Claude yanıtı ayrıştırılamadı, tekrar deneyin', {
      cause,
    });
  }

  if (!Array.isArray(parsed)) {
    throw new InventoryVisionError('Claude yanıtı ayrıştırılamadı, tekrar deneyin');
  }

  const items = parsed
    .map(toInventoryItem)
    .filter((item): item is InventoryItem => item !== null);

  if (items.length === 0) {
    throw new InventoryVisionError('Claude yanıtı ayrıştırılamadı, tekrar deneyin');
  }

  return items;
}

/**
 * Bir veya daha fazla görüntüden (base64, data URI prefix'i olmadan)
 * Claude vision API kullanarak envanter ürünlerini çıkarır.
 *
 * Birden fazla görüntü gönderilirse, bunların aynı buzdolabının/mutfağın
 * farklı anlarına ait kareler (bir videodan çıkarılmış) olduğu varsayılır
 * ve sistem talimatına tekilleştirme kuralı eklenir.
 */
export async function extractInventoryFromImages(
  images: string[]
): Promise<InventoryItem[]> {
  if (images.length === 0) {
    throw new InventoryVisionError('Çıkarım için en az bir görüntü gerekli');
  }

  const systemPrompt =
    images.length > 1
      ? `${BASE_SYSTEM_PROMPT}${MULTI_FRAME_SYSTEM_PROMPT_SUFFIX}`
      : BASE_SYSTEM_PROMPT;

  const imageBlocks = images.map((data) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/jpeg' as const,
      data,
    },
  }));

  let responseText: string;
  try {
    responseText = await callClaudeForText({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
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
    });
  } catch (error) {
    if (error instanceof InventoryVisionError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new InventoryVisionError(
      `Claude API çağrısı başarısız oldu: ${message}`,
      { cause: error }
    );
  }

  return parseInventoryItems(responseText);
}
