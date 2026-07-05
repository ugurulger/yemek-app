import type { InventoryConfidence, InventoryItem, InventoryUnit } from '@/types/inventory';

import { InventoryVisionError } from './types';

const VALID_UNITS: InventoryUnit[] = ['adet', 'g', 'kg', 'ml', 'l', 'demet'];
const VALID_CONFIDENCES: InventoryConfidence[] = ['high', 'low'];

/**
 * İki aşamalı vision akışının PAYLAŞILAN promptları — Claude
 * (`claude-provider.ts`) ve Gemini (`gemini-provider.ts`) ikisi de bu
 * metinleri kullanır (MVP-3'te Claude, MVP-4'te Gemini için benimsendi).
 * Kök neden: tek-aşamalı sıkı JSON şeması modelin gözlem detayını
 * kısıtlıyordu (bkz. SKILL.md § "Sağlayıcı karşılaştırma notları").
 *
 * Aşama 1 — gözlem: görselleri ŞEMA DAYATMADAN, serbest metinle betimlet.
 * Aşama 2 — yapılandırma: o metni ucuz/basit bir çağrıyla JSON şemasına
 * dönüştür. Aşama 2'nin çıktısı `parseInventoryItems` ile ayrıştırılır
 * (opsiyonel "brand" alanı dahil, bkz. `toInventoryItem`).
 */
export const OBSERVATION_SYSTEM_PROMPT =
  'Buzdolabı/mutfak fotoğraflarını veya video karelerini dikkatlice incele ve ' +
  'gördüğün TÜM ürünleri düz metin halinde, madde madde anlat. Her ürün için ' +
  'mümkünse şunları belirt: marka/çeşit, hangi raf veya çekmecede olduğu, tahmini ' +
  'miktar/adet, ve emin olamadığın noktaları. Küçük, kısmen görünen veya arka ' +
  'plandaki ürünleri de atlama — ambalaj üzerindeki yazıları okuyabiliyorsan oku. ' +
  'JSON DEĞİL, sadece düz metin (madde madde liste) olarak yaz.';

export const OBSERVATION_MULTI_FRAME_SUFFIX =
  ' Gönderilen görüntüler aynı buzdolabının/mutfağın farklı anlarına ait kareler. ' +
  'Aynı ürünü birden fazla karede görüyorsan TEKRAR YAZMA — hangi karede/konumda ' +
  'gördüğünü belirterek tek maddede anlat.';

export function buildObservationPrompt(imageCount: number): string {
  return imageCount > 1
    ? `${OBSERVATION_SYSTEM_PROMPT}${OBSERVATION_MULTI_FRAME_SUFFIX}`
    : OBSERVATION_SYSTEM_PROMPT;
}

export const STRUCTURING_SYSTEM_PROMPT =
  'Sana bir buzdolabı/mutfak envanterinin serbest metin açıklaması verilecek. Bunu ' +
  'aşağıdaki JSON şemasına dönüştür, metinde geçen HİÇBİR ürünü atlama: ' +
  '[{ "name": string, "qty": number, "unit": "adet|g|kg|ml|l|demet", "emoji": string, ' +
  '"brand": string | null, "confidence": "high|low" }]. "name" Türkçe ve genel ürün ' +
  'adı olmalı (örn. "süt", "peynir", "domates") — marka adını "name" içine değil ' +
  '"brand" alanına koy; marka belirtilmemişse "brand": null kullan. Metinde aynı genel ' +
  'üründen birden fazla adet/paket geçiyorsa TEK satırda topla. Metinde belirsiz/emin ' +
  'olunamayan olarak geçen ürünler için "confidence": "low", diğerleri için "high" ' +
  'kullan. SADECE JSON dön, markdown backtick yok, açıklama yok.';

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
  const brand = obj.brand;

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
    ...(typeof brand === 'string' && brand.trim().length > 0 ? { brand: brand.trim() } : {}),
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
