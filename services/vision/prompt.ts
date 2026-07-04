import type { InventoryConfidence, InventoryItem, InventoryUnit } from '@/types/inventory';

import { InventoryVisionError } from './types';

const VALID_UNITS: InventoryUnit[] = ['adet', 'g', 'kg', 'ml', 'l', 'demet'];
const VALID_CONFIDENCES: InventoryConfidence[] = ['high', 'low'];

/**
 * SKILL.md → "Fotoğraf/Video → envanter" bölümündeki JSON şemasıyla birebir
 * aynı olmalı. Tüm sağlayıcılar (Claude, Gemini, ...) bu metni kullanır.
 */
export const BASE_SYSTEM_PROMPT =
  'Fiş fotoğrafı veya buzdolabı görüntülerinden ürünleri çıkar. SADECE JSON dön: ' +
  '[{ "name": string, "qty": number, "unit": "adet|g|kg|ml|l|demet", "emoji": string, "confidence": "high|low" }]. ' +
  '"name" alanı Türkçe ve genel ürün adı olmalı (örn. "süt", "peynir", "domates", "yumurta") — ' +
  'marka adı, ambalaj üzerindeki yabancı dil metni veya çeşit detayı KULLANMA. ' +
  'Aynı genel üründen birden fazla adet/paket varsa TEK satırda topla, miktarı (qty) buna göre ver. ' +
  'Markdown backtick yok, açıklama yok.';

export const MULTI_FRAME_SYSTEM_PROMPT_SUFFIX =
  ' Gönderilen görüntüler aynı buzdolabının/mutfağın farklı anlarına ait kareler. ' +
  'Aynı ürünü birden fazla karede görüyorsan TEKİLLEŞTİR — tek bir kayıt olarak dön, ' +
  'miktarı en güvenilir kareye göre belirle.';

export function buildSystemPrompt(imageCount: number): string {
  return imageCount > 1
    ? `${BASE_SYSTEM_PROMPT}${MULTI_FRAME_SYSTEM_PROMPT_SUFFIX}`
    : BASE_SYSTEM_PROMPT;
}

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

/**
 * Sağlayıcıdan (Claude/Gemini) gelen ham metin yanıtını doğrular ve
 * InventoryItem[] listesine çevirir. Yanıt parse edilemezse veya geçerli
 * hiçbir ürün yoksa InventoryVisionError fırlatır — çağıran taraf asla boş
 * envanter yazmamalı, kullanıcıya "tekrar dene" göstermeli.
 */
export function parseInventoryItems(responseText: string): InventoryItem[] {
  const cleaned = stripMarkdownFence(responseText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (cause) {
    throw new InventoryVisionError('Yanıt ayrıştırılamadı, tekrar deneyin', { cause });
  }

  if (!Array.isArray(parsed)) {
    throw new InventoryVisionError('Yanıt ayrıştırılamadı, tekrar deneyin');
  }

  const items = parsed
    .map(toInventoryItem)
    .filter((item): item is InventoryItem => item !== null);

  if (items.length === 0) {
    throw new InventoryVisionError('Yanıt ayrıştırılamadı, tekrar deneyin');
  }

  return items;
}
