/**
 * Tier 2 — fuzzy skorlama. NL arama sorgusu + (varsa) sözlük ipuçları ile
 * mağaza ürün adı arasında token örtüşmesi + birim/miktar uyumu puanlar.
 * Saf fonksiyonlar — birim testli (tests/unit/match-fuzzy.test.ts).
 *
 * Token eşleme mantığı vision-eval `namesMatch`'in portudur: birebir token
 * eşitliği veya ≥4 harfli token'larda ortak 4 harfli önek.
 */

import type { StoreProduct } from '@/services/stores/types';

/** Bu skorun üstü LLM'siz kabul edilir (eval scriptiyle ayarlanır). */
export const FUZZY_ACCEPT_THRESHOLD = 70;

/** Bu güvenin altı UI'da "eşleşmeyi kontrol et" işareti alır. */
export const LOW_CONFIDENCE_THRESHOLD = 70;

function normalizeNl(text: string): string {
  return text
    .normalize('NFC')
    .toLocaleLowerCase('nl-NL')
    .replace(/[().,;:/\\!?"'’`&+%-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeNl(text).split(' ').filter(Boolean);
}

/** "uiensoep", "uiensaus" gibi türev ürünleri ele veren NL son ekleri. */
const DERIVED_SUFFIXES = ['soep', 'saus', 'mix', 'chips', 'smaak', 'kruiden', 'ringen'];

function tokenMatches(queryToken: string, productToken: string): { hit: boolean; derived: boolean } {
  if (queryToken === productToken) {
    return { hit: true, derived: false };
  }
  // NL bileşik kelimede baş (head) SONDADIR: "rundergehakt" bir gehakt
  // türüdür (iyi eşleşme); "uiensoep" ise soğan değil çorbadır (türev).
  if (queryToken.length >= 4 && productToken.endsWith(queryToken)) {
    return { hit: true, derived: false };
  }
  if (queryToken.length >= 4 && productToken.startsWith(queryToken)) {
    // "uien" → "uiensoep": önek tutuyor ama kalan kısım türev ürün son eki.
    const rest = productToken.slice(queryToken.length);
    const derived = DERIVED_SUFFIXES.some((suffix) => rest.startsWith(suffix));
    return { hit: true, derived };
  }
  if (queryToken.length >= 4 && productToken.length >= 4 && queryToken.slice(0, 4) === productToken.slice(0, 4)) {
    // Çoğul/çekim farkları: "ui"/"uien" değil ama "tomaten"/"tomatenblokjes" gibi.
    return { hit: true, derived: false };
  }
  return { hit: false, derived: false };
}

/** "500 g", "1.5 l", "4 x 140 g", "10 stuks", "per stuk" → gram/ml/adet cinsinden miktar. */
export function parseUnitSize(unitSize: string): { kind: 'mass' | 'volume' | 'count'; amount: number } | null {
  // normalizeNl KULLANILMAZ — noktayı/virgülü boşluğa çevirir, "1.5 l" bozulur.
  const text = unitSize.normalize('NFC').toLocaleLowerCase('nl-NL').replace(/\s+/g, ' ').trim();
  const multi = text.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gram|l|liter|ml|cl)\b/);
  const single = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo|g|gram|l|liter|ml|cl)\b/);
  const count = text.match(/(\d+)\s*(stuks|stuk|st)\b/);
  const perStuk = /per\s+stuk/.test(text);

  const toNumber = (raw: string) => Number(raw.replace(',', '.'));
  if (multi) {
    const amount = Number(multi[1]) * toNumber(multi[2]);
    const unit = multi[3];
    if (unit === 'kg') return { kind: 'mass', amount: amount * 1000 };
    if (unit === 'l' || unit === 'liter') return { kind: 'volume', amount: amount * 1000 };
    if (unit === 'cl') return { kind: 'volume', amount: amount * 10 };
    if (unit === 'ml') return { kind: 'volume', amount };
    return { kind: 'mass', amount };
  }
  if (single) {
    const amount = toNumber(single[1]);
    const unit = single[2];
    if (unit === 'kg' || unit === 'kilo') return { kind: 'mass', amount: amount * 1000 };
    if (unit === 'l' || unit === 'liter') return { kind: 'volume', amount: amount * 1000 };
    if (unit === 'cl') return { kind: 'volume', amount: amount * 10 };
    if (unit === 'ml') return { kind: 'volume', amount };
    return { kind: 'mass', amount };
  }
  if (count) {
    return { kind: 'count', amount: Number(count[1]) };
  }
  if (perStuk) {
    return { kind: 'count', amount: 1 };
  }
  return null;
}

/** Türkçe tarif birimini parseUnitSize ile karşılaştırılabilir türe çevirir. */
function itemNeed(qty: number, unit: string): { kind: 'mass' | 'volume' | 'count'; amount: number } | null {
  const u = unit.trim().toLocaleLowerCase('tr-TR');
  if (u === 'g' || u === 'gram') return { kind: 'mass', amount: qty };
  if (u === 'kg') return { kind: 'mass', amount: qty * 1000 };
  if (u === 'ml') return { kind: 'volume', amount: qty };
  if (u === 'l' || u === 'lt' || u === 'litre') return { kind: 'volume', amount: qty * 1000 };
  if (u === 'adet' || u === 'demet' || u === 'paket' || u === 'kutu' || u === 'dilim') {
    return { kind: 'count', amount: qty };
  }
  return null; // "su bardağı", "yk" gibi mutfak ölçüleri — birim uyumu puanlanmaz
}

/**
 * 0-100 skor: sorgu token örtüşmesi (0-55) + ipucu bonusu (0-25) +
 * birim/miktar uyumu (-10..+15) + türev-ürün ve fazla-token cezaları.
 */
export function scoreProduct(
  nlQuery: string,
  hints: readonly string[],
  item: { qty: number; unit: string },
  product: StoreProduct
): number {
  const queryTokens = tokenize(nlQuery);
  const productTokens = tokenize(product.name);
  if (queryTokens.length === 0 || productTokens.length === 0) {
    return 0;
  }

  let hits = 0;
  let derivedHits = 0;
  for (const qt of queryTokens) {
    const match = productTokens
      .map((pt) => tokenMatches(qt, pt))
      .find((m) => m.hit);
    if (match?.hit) {
      hits += 1;
      if (match.derived) {
        derivedHits += 1;
      }
    }
  }
  if (hits === 0) {
    return 0;
  }

  let score = (hits / queryTokens.length) * 55;

  // İpucu bonusu: sözlük matchHints token'ları ürün adında geçiyorsa.
  const productNorm = normalizeNl(product.name);
  const hintHit = hints.some((hint) => productNorm.includes(normalizeNl(hint)));
  if (hintHit) {
    score += 25;
  } else if (hints.length === 0) {
    // İpucu tanımlı değilse bonusun yokluğu cezaya dönüşmesin diye taban ekle.
    score += 20;
  }

  // Türev ürün cezası ("uien" → "uiensoep").
  score -= derivedHits * 25;

  // Fazla token cezası: ürün adı sorgudan çok daha kalabalıksa hafif düşür.
  const extraTokens = Math.max(0, productTokens.length - queryTokens.length - 2);
  score -= Math.min(12, extraTokens * 3);

  // Birim/miktar uyumu.
  const need = itemNeed(item.qty, item.unit);
  const pack = product.unitSize ? parseUnitSize(product.unitSize) : null;
  if (need && pack) {
    if (need.kind === pack.kind) {
      const ratio = pack.amount / Math.max(need.amount, 0.001);
      if (ratio >= 0.5 && ratio <= 8) {
        score += 15; // makul paket boyutu
      } else if (ratio > 20 || ratio < 0.05) {
        score -= 10; // absürt boyut (2 adet soğan için 10 kg çuval gibi)
      } else {
        score += 5;
      }
    }
    // tür uyuşmazlığı (count vs mass) cezalandırılmaz — "2 adet soğan" ↔ "1 kg" meşru
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
