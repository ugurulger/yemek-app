import {
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  type InventoryCategory,
  type InventoryItem,
  type InventoryUnit,
} from '@/types/inventory';

import { InventoryVisionError } from './types';

// İki aşamalı JSON akışının prompt'ları hâlâ bu alt kümeyi dayatıyor —
// genişletilmiş INVENTORY_UNITS (paket/kutu/... dahil) şimdilik sadece
// video → envanter responseSchema akışında kullanılıyor.
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

// Video girdisi için — TEK çağrı, native structured output (responseSchema,
// bkz. `gemini-provider.ts` — `VIDEO_INVENTORY_RESPONSE_SCHEMA`). Eski
// `VIDEO_TABLE_PROMPT` (markdown tablo + placeholder satırı + konum/gerekçe
// sütunları) kaldırıldı: serbest markdown + kırılgan parser kombinasyonu
// satırları sessizce düşürüyordu ve gemini-2.5-pro'nun varsayılan
// temperature'ıyla (1.0) birlikte aynı videodan farklı sonuçlar üretiyordu.
// Yapı/format talimatlarının tamamı gereksiz — şema yapıyı zaten garanti
// ediyor; prompt sadece GÖREVİ ve isimlendirme/confidence kurallarını anlatır.
export const VIDEO_INVENTORY_PROMPT = `Buzdolabı videosunu sistematik olarak analiz et: her rafı, kapı gözünü ve çekmeceyi tek tek incele, gördüğün TÜM ürünleri çıkar — küçük, kısmen görünen veya arka plandaki ürünleri de atlama.

Kurallar:
- "name" SPESİFİK Türkçe ürün adı olmalı; sıfat tamlaması tercih edilir: "Küflü Peynir", "Cherry Domates", "Kırmızı Biber". Tekli ürünler sade kalır: "Süt", "Marul", "Maydanoz". Marka adını "name" alanına YAZMA — ambalajda görünüyorsa "brand" alanına koy, görünmüyorsa null bırak.
- "category" için SADECE şemadaki sabit listeden bir değer seç.
- "reasoning": bu ürünü neden bu isimle ve bu netlikte tanımladığının TEK CÜMLELİK özeti (örn. "Etiketteki Milner yazısı net okunuyor"). Bunu "confidence"tan ÖNCE yaz.
- "confidence" (0-100) kalibrasyonu: 95-100 = etiket/ambalaj yazısı net okunuyor VEYA ürünün şekli tartışmasız (yumurta, marul gibi); 80-94 = ürün türü netçe belli ama detay (çeşit/marka) tam seçilemiyor; 50-79 = form tahmin edilebilir ama emin değilsin; 50'nin altı = sadece tahmin.`;

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
  // NOT: iki aşamalı akışın prompt'ları hâlâ "location" isteyebilir, ama
  // alan InventoryItem'dan kaldırıldı (responseSchema geçişi) — yok sayılır.

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

function toVideoInventoryItem(raw: unknown): InventoryItem | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const { name, brand, qty, unit, category, confidence, reasoning } = obj;

  // İsimsiz öğe düzeltilemez — düşürülür (şema zorunlu kıldığı için beklenmez).
  if (typeof name !== 'string' || name.trim().length === 0) {
    return null;
  }

  // MVP-13: "reasoning" SADECE modelin kendi kalibrasyonu için var (confidence
  // alanından ÖNCE yazdırılıyor, bkz. gemini-provider.ts —
  // VIDEO_INVENTORY_RESPONSE_SCHEMA notu) — InventoryItem'a EKLENMEZ, UI'da
  // GÖSTERİLMEZ, burada okunup atılır. Sadece debug logunda görünür.
  if (typeof reasoning === 'string' && reasoning.trim().length > 0) {
    console.debug(`[vision] "${name}" (%${confidence}) gerekçe: ${reasoning.trim()}`);
  }

  return {
    id: generateId(),
    name: name.trim(),
    // Geçersiz değerleri düşürmek yerine mümkün olduğunca düzelt: şema bu
    // alanları zaten garanti ediyor, buradaki toleranslar sadece emniyet kemeri.
    qty: typeof qty === 'number' && Number.isFinite(qty) && qty > 0 ? qty : 1,
    unit: isValidVideoUnit(unit) ? unit : 'adet',
    emoji: '🍽️',
    confidence:
      typeof confidence === 'number' && Number.isFinite(confidence)
        ? Math.min(100, Math.max(0, Math.round(confidence)))
        : 50,
    category: isValidCategory(category) ? category : 'Diğer',
    ...(typeof brand === 'string' && brand.trim().length > 0 && brand.trim() !== '-'
      ? { brand: brand.trim() }
      : {}),
  };
}

function isValidVideoUnit(value: unknown): value is InventoryUnit {
  return typeof value === 'string' && (INVENTORY_UNITS as readonly string[]).includes(value);
}

function isValidCategory(value: unknown): value is InventoryCategory {
  return typeof value === 'string' && (INVENTORY_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Video → envanter akışının responseSchema'lı JSON yanıtını (bkz.
 * `gemini-provider.ts` — `VIDEO_INVENTORY_RESPONSE_SCHEMA`) doğrular ve
 * `InventoryItem[]`'e çevirir. Eski markdown-tablo parser'ının
 * (`markdown-table.ts`, @deprecated) yerini alır. Şema yapıyı garanti
 * ettiğinden doğrulama minimaldir; yine de geçersiz bir değer gelirse öğeyi
 * düşürmek yerine düzeltir: tanınmayan kategori → "Diğer", aralık dışı
 * confidence → 0-100'e kırpılır, geçersiz qty/unit → 1 "adet". Hiç geçerli
 * öğe yoksa `InventoryVisionError` fırlatılır — çağıran taraf asla boş
 * envanter yazmamalı, kullanıcıya "tekrar dene" göstermeli.
 */
export function parseVideoInventoryItems(responseText: string): InventoryItem[] {
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
    .map(toVideoInventoryItem)
    .filter((item): item is InventoryItem => item !== null);

  if (items.length === 0) {
    throw new InventoryVisionError('Yanıt ayrıştırılamadı, tekrar deneyin');
  }

  return items;
}
