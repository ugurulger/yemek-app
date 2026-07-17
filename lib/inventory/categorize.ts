/**
 * Malzeme adı → kategori eşlemesi (asistanla ekleme akışının tek kaynağı).
 *
 * Kök neden (kullanıcı bug bildirimi: patlıcan "Diğer"e, nohut "Buzdolabı >
 * Diğer"e düşüyordu): `parseIngredients` şeması hiç kategori üretmiyordu —
 * asistanla eklenen her ürün kategorisiz kalıp "Diğer" grubuna düşüyordu.
 *
 * Çözüm iki katmanlı:
 * 1. Buradaki DETERMİNİSTİK eşleme — yaygın Türk mutfağı malzemeleri için
 *    ad bazlı kelime eşleşmesi (model çıktısından bağımsız, test edilebilir).
 * 2. AI kategorisi (parseIngredients şemasına eklendi) — deterministik
 *    eşleme adı tanımıyorsa modelin tahmini kullanılır; o da yoksa "Diğer".
 *
 * Bakliyat/tahıl ürünleri buzdolabı envanterine DEĞİL, Mutfağım'ın alt
 * kısmındaki Temel Malzemeler'in "Bakliyat & Makarna" kategorisine yönlenir
 * (kullanıcı kararı — "nohut alt kısımdaki bakliyat kategorisine gitmeli").
 */
import type { InventoryCategory } from '@/types/inventory';
import type { PantryCategory } from '@/types/pantry';

export interface CategorizedIngredient {
  /** Buzdolabı envanterine yazılacaksa kullanılacak kategori. */
  inventoryCategory: InventoryCategory;
  /**
   * null değilse ürün buzdolabına değil Temel Malzemeler'e (kiler) aittir —
   * asistan envanter modunda bile bu ürünleri kilere yönlendirir.
   */
  pantryCategory: PantryCategory | null;
}

/** AI şemasındaki kategori listesi (parseIngredients prompt'uyla birebir). */
export const AI_INGREDIENT_CATEGORIES = [
  'Sebze',
  'Meyve',
  'Et & Tavuk & Balık',
  'Süt Ürünleri',
  'Peynir',
  'Bakliyat & Tahıl',
  'Sos & Baharat',
  'Diğer',
] as const;

type AiIngredientCategory = (typeof AI_INGREDIENT_CATEGORIES)[number];

/** AI kategorisi → uygulama kategorisi (bakliyat/tahıl kilere yönlenir). */
const AI_CATEGORY_MAP: Record<AiIngredientCategory, CategorizedIngredient> = {
  Sebze: { inventoryCategory: 'Meyve & Sebze', pantryCategory: null },
  Meyve: { inventoryCategory: 'Meyve & Sebze', pantryCategory: null },
  'Et & Tavuk & Balık': { inventoryCategory: 'Şarküteri', pantryCategory: null },
  'Süt Ürünleri': { inventoryCategory: 'Süt Ürünleri', pantryCategory: null },
  Peynir: { inventoryCategory: 'Peynir', pantryCategory: null },
  'Bakliyat & Tahıl': { inventoryCategory: 'Diğer', pantryCategory: 'Bakliyat & Makarna' },
  'Sos & Baharat': { inventoryCategory: 'Sos & Baharat', pantryCategory: null },
  Diğer: { inventoryCategory: 'Diğer', pantryCategory: null },
};

const OTHER: CategorizedIngredient = { inventoryCategory: 'Diğer', pantryCategory: null };

/** Kısayollar — KEYWORD_MAP okunaklı kalsın. */
const SEBZE_MEYVE: CategorizedIngredient = {
  inventoryCategory: 'Meyve & Sebze',
  pantryCategory: null,
};
const ET: CategorizedIngredient = { inventoryCategory: 'Şarküteri', pantryCategory: null };
const SUT: CategorizedIngredient = { inventoryCategory: 'Süt Ürünleri', pantryCategory: null };
const PEYNIR: CategorizedIngredient = { inventoryCategory: 'Peynir', pantryCategory: null };
const SOS: CategorizedIngredient = { inventoryCategory: 'Sos & Baharat', pantryCategory: null };
const BAKLIYAT: CategorizedIngredient = {
  inventoryCategory: 'Diğer',
  pantryCategory: 'Bakliyat & Makarna',
};

/**
 * Yaygın Türk mutfağı malzemeleri — anahtar KELİME(ler) normalize edilmiş
 * hâliyle. Eşleşme kelime bazlıdır ("yeşil biber" ↔ "biber" eşleşir ama
 * "karabiber" TEK kelime olduğu için "biber"le EŞLEŞMEZ) ve çok kelimeli
 * anahtarlar önce denenir ("kuru fasulye" bakliyata, sade "fasulye" sebzeye).
 */
const KEYWORD_MAP: Record<string, CategorizedIngredient> = {
  // Sebzeler
  patlıcan: SEBZE_MEYVE,
  domates: SEBZE_MEYVE,
  biber: SEBZE_MEYVE, // yeşil/kırmızı/sivri biber; karabiber-pul biber alta bakın
  salatalık: SEBZE_MEYVE,
  kabak: SEBZE_MEYVE,
  havuç: SEBZE_MEYVE,
  patates: SEBZE_MEYVE,
  soğan: SEBZE_MEYVE,
  sarımsak: SEBZE_MEYVE,
  marul: SEBZE_MEYVE,
  ıspanak: SEBZE_MEYVE,
  pırasa: SEBZE_MEYVE,
  lahana: SEBZE_MEYVE,
  karnabahar: SEBZE_MEYVE,
  brokoli: SEBZE_MEYVE,
  maydanoz: SEBZE_MEYVE,
  dereotu: SEBZE_MEYVE,
  roka: SEBZE_MEYVE,
  turp: SEBZE_MEYVE,
  kereviz: SEBZE_MEYVE,
  mantar: SEBZE_MEYVE,
  fasulye: SEBZE_MEYVE, // taze fasulye; "kuru fasulye" bakliyatta ezer
  bamya: SEBZE_MEYVE,
  enginar: SEBZE_MEYVE,
  pancar: SEBZE_MEYVE,
  mısır: SEBZE_MEYVE,
  bezelye: SEBZE_MEYVE,
  semizotu: SEBZE_MEYVE,
  // Meyveler (görüntüleme kategorisi aynı: Meyve & Sebze)
  elma: SEBZE_MEYVE,
  muz: SEBZE_MEYVE,
  portakal: SEBZE_MEYVE,
  mandalina: SEBZE_MEYVE,
  limon: SEBZE_MEYVE,
  greyfurt: SEBZE_MEYVE,
  çilek: SEBZE_MEYVE,
  üzüm: SEBZE_MEYVE,
  armut: SEBZE_MEYVE,
  şeftali: SEBZE_MEYVE,
  kayısı: SEBZE_MEYVE,
  erik: SEBZE_MEYVE,
  kiraz: SEBZE_MEYVE,
  vişne: SEBZE_MEYVE,
  karpuz: SEBZE_MEYVE,
  kavun: SEBZE_MEYVE,
  nar: SEBZE_MEYVE,
  incir: SEBZE_MEYVE,
  kivi: SEBZE_MEYVE,
  ananas: SEBZE_MEYVE,
  avokado: SEBZE_MEYVE,
  // Et / tavuk / balık (yumurta → Şarküteri, MVP-18 kararıyla tutarlı)
  kıyma: ET,
  tavuk: ET,
  piliç: ET,
  hindi: ET,
  dana: ET,
  kuzu: ET,
  biftek: ET,
  pirzola: ET,
  sucuk: ET,
  sosis: ET,
  salam: ET,
  jambon: ET,
  pastırma: ET,
  kavurma: ET,
  somon: ET,
  levrek: ET,
  çipura: ET,
  hamsi: ET,
  balık: ET,
  // k→ğ yumuşaması önek eşleşmesini kırar ("balığı" ≠ "balık" öneki) — açık kayıt:
  'ton balığı': ET,
  karides: ET,
  yumurta: ET,
  // Süt ürünleri
  süt: SUT,
  yoğurt: SUT,
  krema: SUT,
  kaymak: SUT,
  tereyağı: SUT,
  ayran: SUT,
  kefir: SUT,
  labne: SUT,
  // Peynirler ("peynir" kelimesi kaşar peyniri, beyaz peynir vb. yakalar)
  peynir: PEYNIR,
  kaşar: PEYNIR,
  lor: PEYNIR,
  hellim: PEYNIR,
  mozzarella: PEYNIR,
  parmesan: PEYNIR,
  çökelek: PEYNIR,
  tulum: PEYNIR,
  // Bakliyat & tahıl → Temel Malzemeler'in Bakliyat & Makarna kategorisi
  nohut: BAKLIYAT,
  mercimek: BAKLIYAT,
  'kuru fasulye': BAKLIYAT,
  barbunya: BAKLIYAT,
  börülce: BAKLIYAT,
  bulgur: BAKLIYAT,
  pirinç: BAKLIYAT,
  makarna: BAKLIYAT,
  şehriye: BAKLIYAT,
  spagetti: BAKLIYAT,
  erişte: BAKLIYAT,
  kuskus: BAKLIYAT,
  yulaf: BAKLIYAT,
  irmik: BAKLIYAT,
  // Sos & baharat
  salça: SOS,
  ketçap: SOS,
  mayonez: SOS,
  hardal: SOS,
  'soya sosu': SOS,
  sirke: SOS,
  zeytin: SOS,
  turşu: SOS,
  konserve: SOS,
  bal: SOS,
  reçel: SOS,
  tahin: SOS,
  pekmez: SOS,
  tuz: SOS,
  karabiber: SOS,
  'pul biber': SOS,
  'toz biber': SOS,
  'toz kırmızı biber': SOS,
  'kırmızı toz biber': SOS,
  kimyon: SOS,
  kekik: SOS,
  nane: SOS,
  sumak: SOS,
  tarçın: SOS,
  vanilya: SOS,
  zeytinyağı: SOS,
  'sıvı yağ': SOS,
  'ayçiçek yağı': SOS,
};

/** Türkçe'ye duyarlı normalizasyon + kelimelere bölme. */
function toWords(name: string): string[] {
  return name.trim().toLocaleLowerCase('tr-TR').split(/\s+/).filter(Boolean);
}

/**
 * keyWords, nameWords içinde ardışık kelime dizisi olarak geçiyor mu?
 * Kelime karşılaştırması ÖNEK bazlıdır: Türkçe iyelik/çekim ekleri kelime
 * eşitliğini kırar ("kaşar peynirİ" → "peynir", "ton balığI" → "balık").
 * "karabiber" gibi bitişik kelimeler yine de "biber"le EŞLEŞMEZ (önek değil).
 */
function wordsInclude(nameWords: string[], keyWords: string[]): boolean {
  for (let i = 0; i + keyWords.length <= nameWords.length; i++) {
    if (keyWords.every((word, j) => nameWords[i + j].startsWith(word))) {
      return true;
    }
  }
  return false;
}

// Çok kelimeli anahtarlar önce ("kuru fasulye" > "fasulye"), eşitse uzun olan.
const SORTED_KEYWORDS = Object.keys(KEYWORD_MAP).sort((a, b) => {
  const wordDiff = b.split(' ').length - a.split(' ').length;
  return wordDiff !== 0 ? wordDiff : b.length - a.length;
});

/**
 * Malzeme adını kategorize eder: önce deterministik kelime eşlemesi, adı
 * tanımıyorsa AI kategorisi (`aiCategory`), o da yok/tanınmıyorsa "Diğer".
 */
export function categorizeIngredient(name: string, aiCategory?: string): CategorizedIngredient {
  const nameWords = toWords(name);
  if (nameWords.length > 0) {
    for (const keyword of SORTED_KEYWORDS) {
      if (wordsInclude(nameWords, keyword.split(' '))) {
        return KEYWORD_MAP[keyword];
      }
    }
  }
  if (aiCategory && aiCategory in AI_CATEGORY_MAP) {
    return AI_CATEGORY_MAP[aiCategory as AiIngredientCategory];
  }
  return OTHER;
}
