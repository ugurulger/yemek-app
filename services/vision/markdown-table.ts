import type { InventoryCategory, InventoryItem, InventoryUnit } from '@/types/inventory';

import { InventoryVisionError } from './types';

// VIDEO_TABLE_PROMPT'un (bkz. ./prompt.ts) modele dayattığı sabit liste —
// bu listede olmayan bir değer dönerse "Diğer"e eşlenir.
const VALID_CATEGORIES: InventoryCategory[] = [
  'İçecek',
  'Süt Ürünleri',
  'Peynir',
  'Şarküteri',
  'Meyve & Sebze',
  'Sos & Baharat',
  'Diğer',
];

// "Miktar / Detay" hücresinden ayrıştırılabilen birim kelimeleri —
// VIDEO_TABLE_PROMPT bu kelimelerin hangisini kullanacağını dayatmıyor,
// modelin doğal dil çıktısında görülen yaygın varyantlar bunlar. InventoryUnit
// olmayanlar (paket/kutu/kavanoz/dilim) 'adet'e eşlenir, ham metin `detail`
// alanında kaybolmadan saklanır.
const UNIT_ALIASES: Record<string, InventoryUnit> = {
  adet: 'adet',
  paket: 'adet',
  kutu: 'adet',
  kavanoz: 'adet',
  dilim: 'adet',
  kg: 'kg',
  ml: 'ml',
  g: 'g',
  l: 'l',
  demet: 'demet',
};

const QTY_UNIT_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(adet|paket|kutu|kavanoz|dilim|kg|ml|g|l|demet)\b/i;
const CONFIDENCE_PATTERN = /(\d+(?:[.,]\d+)?)\s*%/;

// VIDEO_TABLE_PROMPT'un talimatıyla tablonun en altına eklenen sabit
// placeholder satırı — inventory'e ürün olarak eklenmez.
const PLACEHOLDER_MARKERS = ['Buzdolabı Dışı', 'Yeni ürünleri'];

function generateId(): string {
  // React Native'de crypto.randomUUID her zaman mevcut olmayabilir.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function splitTableRow(line: string): string[] {
  const withoutEdgePipes = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return withoutEdgePipes.split('|').map((cell) => cell.trim());
}

function isPlaceholderRow(location: string, name: string): boolean {
  return PLACEHOLDER_MARKERS.some((marker) => location.includes(marker) || name.includes(marker));
}

function parseQtyAndUnit(detailRaw: string): { qty: number; unit: InventoryUnit } {
  const match = detailRaw.match(QTY_UNIT_PATTERN);
  if (!match) {
    return { qty: 1, unit: 'adet' };
  }
  const qty = parseFloat(match[1].replace(',', '.'));
  const unit = UNIT_ALIASES[match[2].toLowerCase()] ?? 'adet';
  return { qty: Number.isFinite(qty) && qty > 0 ? qty : 1, unit };
}

function parseConfidence(confidenceRaw: string): number {
  const match = confidenceRaw.match(CONFIDENCE_PATTERN);
  if (!match) {
    console.warn(
      `[markdown-table] Doğruluk yüzdesi ayrıştırılamadı: "${confidenceRaw}" — varsayılan %50 kullanılıyor.`
    );
    return 50;
  }
  return Math.round(parseFloat(match[1].replace(',', '.')));
}

// "Kategori" hücresi VIDEO_TABLE_PROMPT'un dayattığı sabit listeden gelmeli;
// model yine de tanınmayan/boş bir değer dönerse "Diğer"e düşürülür (silinmiş
// değil, sadece gruplanamayan ürünler bölümüne düşer).
function parseCategory(categoryRaw: string): InventoryCategory {
  const trimmed = categoryRaw.trim();
  const match = VALID_CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  return match ?? 'Diğer';
}

/**
 * Gemini'nin `VIDEO_TABLE_PROMPT`'a (bkz. `./prompt.ts`) yanıt olarak
 * döndürdüğü markdown tabloyu `InventoryItem[]`'e çevirir. Sütun sırası sabit
 * (Bölüm/Konum, Ürün Adı (Genel), Marka, Miktar/Detay, Kategori, Doğruluk
 * İhtimali, Notlar/Gerekçe) — "Ürün Adı (Genel)" hücresi jenerik Türkçe ad,
 * marka ayrı sütundan gelir ("-" ise `brand` atlanır), "Kategori" sabit
 * listeden biri olmalı (tanınmayan/boş değer "Diğer"e düşer, bkz.
 * `parseCategory`).
 */
export function parseInventoryTable(responseText: string): InventoryItem[] {
  const lines = responseText.split('\n');
  const startIndex = lines.findIndex((line) => line.trimStart().startsWith('|'));

  if (startIndex === -1) {
    throw new InventoryVisionError('Yanıt ayrıştırılamadı, tekrar deneyin');
  }

  const tableLines: string[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    if (!lines[i].trimStart().startsWith('|')) {
      break;
    }
    tableLines.push(lines[i]);
  }

  // tableLines[0] başlık satırı, tableLines[1] "---" ayırıcı satırı — ikisi de atlanır.
  const dataRows = tableLines.slice(2);

  const items: InventoryItem[] = [];
  for (const row of dataRows) {
    const cells = splitTableRow(row);
    if (cells.length < 7) {
      continue;
    }

    const [location, name, brandRaw, detailRaw, categoryRaw, confidenceRaw, note] = cells;
    if (name.length === 0 || isPlaceholderRow(location, name)) {
      continue;
    }

    const { qty, unit } = parseQtyAndUnit(detailRaw);
    const brand = brandRaw.trim();

    items.push({
      id: generateId(),
      name,
      qty,
      unit,
      emoji: '🍽️',
      confidence: parseConfidence(confidenceRaw),
      category: parseCategory(categoryRaw),
      ...(location.length > 0 ? { location } : {}),
      ...(brand.length > 0 && brand !== '-' ? { brand } : {}),
      ...(detailRaw.length > 0 ? { detail: detailRaw } : {}),
      ...(note.length > 0 ? { note } : {}),
    });
  }

  if (items.length === 0) {
    throw new InventoryVisionError('Yanıt ayrıştırılamadı, tekrar deneyin');
  }

  return items;
}
