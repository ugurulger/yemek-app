/**
 * Temel Malzemeler (kiler) — spec §2, görsel `02-mutfagim-temel-malzemeler.png`.
 * Varsayılan liste `lib/claude/generateRecipes.ts`'teki `PANTRY_STAPLES` ile
 * birebir aynı 20 malzemedir; fark: burada kullanıcı chip'e dokunarak tek tek
 * aktif/pasif yapabilir. Tarif üretimine SADECE aktif olanlar "evde var"
 * olarak gönderilir.
 */
export const PANTRY_CATEGORIES = [
  'Baharatlar',
  'Yağlar',
  'Kiler',
  'Bakliyat & Makarna',
  'Sebze Bazları',
] as const;

export type PantryCategory = (typeof PANTRY_CATEGORIES)[number];

export interface PantryItem {
  id: string;
  /**
   * Kanonik malzeme adı — varsayılan 20 malzemede Türkçe'dir ve çevirisi
   * i18n etiketiyle yapılır (labels.ts PANTRY_ITEM_KEYS). Kullanıcının
   * asistanla eklediği malzemelerde eklendiği dildedir.
   */
  name: string;
  /**
   * Kullanıcı eklemeleri için iki dilli ad karşılıkları (envanterdeki
   * nameTr/nameEn kalıbıyla aynı — bkz. types/inventory.ts). Varsayılan
   * malzemelerde DOLDURULMAZ (onların çevirisi i18n anahtarından gelir);
   * eksik karşılık backfillPantryTranslations ile arka planda tamamlanır.
   */
  nameTr?: string;
  nameEn?: string;
  category: PantryCategory;
  /** true = evde var sayılır; kullanıcı chip'e dokununca toggle edilir. */
  active: boolean;
}

/** Varsayılan kiler — `PANTRY_STAPLES` ile aynı içerik, kategorilere ayrılmış. */
export const DEFAULT_PANTRY_ITEMS: readonly Omit<PantryItem, 'id'>[] = [
  { name: 'Tuz', category: 'Baharatlar', active: true },
  { name: 'Karabiber', category: 'Baharatlar', active: true },
  { name: 'Pul Biber', category: 'Baharatlar', active: true },
  { name: 'Kimyon', category: 'Baharatlar', active: true },
  { name: 'Kekik', category: 'Baharatlar', active: true },
  { name: 'Nane', category: 'Baharatlar', active: true },
  // Referans verisiyle birebir (Mutfagim.dc.html satır 671): kısaltılmış ad —
  // uzun hali dar kiler kartında taşıyordu. Tarif üretimi tarafında
  // PANTRY_STAPLES'taki "toz kırmızı biber" adı ayrıca durur (bkz.
  // lib/claude/generateRecipes.ts), model her iki adı da anlar.
  { name: 'Toz K. Biber', category: 'Baharatlar', active: true },
  { name: 'Sıvı Yağ', category: 'Yağlar', active: true },
  { name: 'Zeytinyağı', category: 'Yağlar', active: true },
  { name: 'Tereyağı', category: 'Yağlar', active: true },
  { name: 'Un', category: 'Kiler', active: true },
  { name: 'Şeker', category: 'Kiler', active: true },
  { name: 'Su', category: 'Kiler', active: true },
  { name: 'Sirke', category: 'Kiler', active: true },
  { name: 'Salça', category: 'Kiler', active: true },
  { name: 'Makarna', category: 'Bakliyat & Makarna', active: true },
  { name: 'Pirinç', category: 'Bakliyat & Makarna', active: true },
  { name: 'Bulgur', category: 'Bakliyat & Makarna', active: true },
  { name: 'Soğan', category: 'Sebze Bazları', active: true },
  { name: 'Sarımsak', category: 'Sebze Bazları', active: true },
] as const;
