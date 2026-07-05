import type { InventoryItem, InventoryUnit } from '@/types/inventory';

import { InventoryVisionError } from './types';

const VALID_UNITS: InventoryUnit[] = ['adet', 'g', 'kg', 'ml', 'l', 'demet'];

/**
 * `OBSERVATION_SYSTEM_PROMPT` Claude (`claude-provider.ts`) ve Gemini
 * (`gemini-provider.ts`) arasında PAYLAŞILIR — Aşama 1 (gözlem, görselleri
 * ŞEMA DAYATMADAN serbest metinle betimletme) ikisinde de aynı. Kök neden:
 * tek-aşamalı sıkı JSON şeması modelin gözlem detayını kısıtlıyordu (bkz.
 * SKILL.md § "Sağlayıcı karşılaştırma notları").
 *
 * Aşama 2 (yapılandırma) artık sağlayıcıya göre AYRIŞIYOR (MVP-6): Claude
 * ayrı bir çağrıda `STRUCTURING_SYSTEM_PROMPT`'un katı şemasını kullanmaya
 * devam ediyor; Gemini ise Aşama 1'in AYNI konuşmasının devamı olarak
 * `TABULATION_TURN_PROMPT`'u kullanıyor (bkz. o sabitin yanındaki not).
 * İkisinin çıktısı da aynı `parseInventoryItems` ile ayrıştırılır (opsiyonel
 * "brand"/"location" alanları, 0-100 arası "match_confidence" dahil, bkz.
 * `toInventoryItem`).
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

// Claude'un ayrı (tek-turlu) yapılandırma çağrısı için — Gemini artık bunu
// KULLANMIYOR (bkz. `TABULATION_TURN_PROMPT`, MVP-6 notu aşağıda).
export const STRUCTURING_SYSTEM_PROMPT =
  'Sana bir buzdolabı/mutfak envanterinin serbest metin açıklaması verilecek. Bunu ' +
  'aşağıdaki JSON şemasına dönüştür, metinde geçen HİÇBİR ürünü atlama: ' +
  '[{ "name": string, "qty": number, "unit": "adet|g|kg|ml|l|demet", "emoji": string, ' +
  '"brand": string | null, "location": string | null, "match_confidence": number }]. ' +
  '"name" Türkçe ve genel ürün adı olmalı (örn. "süt", "peynir", "domates") — marka adını ' +
  '"name" içine değil "brand" alanına koy; marka belirtilmemişse "brand": null kullan. ' +
  '"location" ürünün hangi raf/çekmecede/bölümde olduğunu belirtir (örn. "buzdolabı kapısı", ' +
  '"sebze çekmecesi") — metinde konum belirtilmemişse "location": null kullan. Metinde aynı ' +
  'genel üründen birden fazla adet/paket geçiyorsa TEK satırda topla. "match_confidence" 0-100 ' +
  'arası tam sayı olmalı: metinde ürün için "emin olamadım", "olabilir", "muhtemelen" gibi ' +
  'belirsizlik ifadesi kullanılmışsa düşük bir skor ver (40-60 aralığı); ürün net şekilde ' +
  'tanımlanmış ve/veya birden fazla karede tekrar doğrulanmışsa yüksek bir skor ver (85-100 ' +
  'aralığı). SADECE JSON dön, markdown backtick yok, açıklama yok.';

// MVP-6: Gemini'nin yapılandırma turu artık ayrı bir çağrı/katı şema DEĞİL —
// Aşama 1'in (gözlem) aynı konuşmasının devamı olarak, kullanıcının kendi
// AI Studio testinde işe yarayan basit iki-mesajlık akışı taklit eder (bkz.
// SKILL.md "Aşama 2" notu). Bilinçli olarak KISA ve az kısıtlayıcı: Gemini'nin
// kendi tablolaştırma/gruplama sezgisine güveniliyor, "her ürünü ayrı satır
// yap" gibi zorlayıcı kurallar YOK.
export const TABULATION_TURN_PROMPT =
  'Bu envanteri bir tablo olarak, bölüm/konuma göre gruplanmış şekilde göster. Her satırda ' +
  'ürünün adını, miktarını ve bu ürünü ne kadar net/emin gördüğünü 0-100 arası bir yüzde ' +
  'olarak belirt. Sadece gerekli bilgileri ver, JSON formatında dön: ' +
  '[{ "location": string | null, "name": string, "qty": number, ' +
  '"unit": "adet|g|kg|ml|l|demet", "brand": string | null, "match_confidence": number }]. ' +
  'SADECE JSON dön, markdown backtick yok, açıklama yok.';

// MVP-7: Video girdisi için — kullanıcının kendi AI Studio testinde birebir
// çalıştırdığı, native video girişi + TEK çağrıda markdown TABLO isteyen
// prompt (bkz. SKILL.md "Video → envanter (native, MVP-7)"). Gözlem +
// yapılandırma AYRI aşamalar değil, tek istek. Yanıt `parseInventoryTable`
// (`./markdown-table.ts`) ile ayrıştırılır, JSON DEĞİL düz markdown döner.
// MVP-8: kullanıcının orijinal metni "Ürün Adı" + "Marka" sütunlarına
// ayrıştırıldı ve sabit listeli "Kategori" sütunu eklendi (bkz. SKILL.md
// "Video → envanter (native, MVP-7)" — kategori/marka ayrımı notu) — bu artık
// kullanıcının orijinal promptundan sapıyor, UI'daki kategori gruplama ve
// marka rozeti ihtiyacı nedeniyle.
export const VIDEO_TABLE_PROMPT = `You are an expert visual data extraction assistant. Your task is to analyze the provided video frame-by-frame and generate a highly structured, accurate inventory of the items inside the refrigerator. Analyze every shelf, door bin, and drawer systematically.
Please strictly follow these formatting and extraction guidelines:
1. STRUCTURE: Output the result as a Markdown table with the following exact columns:
| Bölüm / Konum | Ürün Adı (Genel) | Marka | Miktar / Detay | Kategori | Doğruluk İhtimali | Notlar / Gerekçe |
2. LANGUAGE: The output inside the table must be in Turkish.
3. PRODUCT NAME vs BRAND:
   - "Ürün Adı (Genel)" must always be a generic Turkish product name (e.g., "Mayonez", "Peynir", "Yumurta") — NEVER put a brand name in this column.
   - "Marka" must contain ONLY the brand/variant name if it is visible on the packaging (e.g., "Arla", "Milner", "Dulano", "Remia"). If no brand is visible or identifiable, write "-".
4. CATEGORY (Kategori):
   - Assign each item to EXACTLY ONE of the following fixed categories, using this exact Turkish text and nothing else: İçecek, Süt Ürünleri, Peynir, Şarküteri, Meyve & Sebze, Sos & Baharat, Diğer.
5. ACCURACY ESTIMATION (Doğruluk İhtimali):
   - Assign a percentage (e.g., 100%, 90%, 75%) indicating how certain you are about the product's identity based on visual clarity, brand visibility, and label readability.
   - In the "Notlar / Gerekçe" column, briefly explain in Turkish why you gave that percentage (e.g., "Marka ve logo net okunuyor", "Şişe formu belirgin ama etiket arkada kalmış").
6. REFRIGERATOR EXTERIOR PLACEHOLDER:
   - At the very bottom of the table, add a final row dedicated to future additions with the following values:
     - Bölüm / Konum: "Buzdolabı Dışı (Eklenecek)"
     - Ürün Adı (Genel): "*Yeni ürünleri gönderdiğinde buraya ekleyeceğiz...*"
     - Marka: Leave empty or "-"
     - Miktar / Detay: Leave empty or "-"
     - Kategori: Leave empty or "-"
     - Doğruluk İhtimali: Leave empty or "-"
     - Notlar / Gerekçe: Leave empty or "-"
7. TONALITY & STYLE: Do not include conversational filler text before or after the table. Output only the final markdown table.`;

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

function isValidConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
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
  const matchConfidence = obj.match_confidence;
  const brand = obj.brand;
  const location = obj.location;

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
    confidence: isValidConfidence(matchConfidence) ? matchConfidence : 100,
    ...(typeof brand === 'string' && brand.trim().length > 0 ? { brand: brand.trim() } : {}),
    ...(typeof location === 'string' && location.trim().length > 0
      ? { location: location.trim() }
      : {}),
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
