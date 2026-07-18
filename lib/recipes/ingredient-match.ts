/**
 * Tarif malzemesi ↔ envanter adı normalize eşleştirmesi (İş 3b) — SAF
 * fonksiyonlar, i18n/store importu YOK (Node test/eval script'lerinde çalışır;
 * aktif dil ekran sınırından parametre olarak iner). Birim testleri:
 * tests/unit/ingredient-match.test.ts (npx tsx --test).
 *
 * İki kullanım yeri:
 * 1. Üretim SONRASI deterministik emniyet katmanı (lib/claude/generateRecipes
 *    + lib/rag/generateRecipesRag → `reconcileIngredientsWithInventory`):
 *    model "envanterdeki ismi AYNEN kullan" talimatına uymazsa bile, envanterle
 *    eşleşen malzeme in_inventory: true yapılır VE adı envanterin aktif
 *    dildeki adıyla DEĞİŞTİRİLİR.
 * 2. computeMissing (lib/recipes/recipe-math.ts) — rozet/bölümleme/sepet aynı
 *    eşleştirme mantığıyla hizalanır.
 *
 * Token mantığı services/matching/fuzzy.ts'in TR/EN'e uyarlanmış hali —
 * mağaza-özel kısımlar (NL bileşik kelime, birim/miktar skoru) BİLİNÇLİ
 * taşınmadı; burada ikili (eşleşti/eşleşmedi) karar yeterli.
 */

import type { RecipeIngredient } from '@/types/recipe';

/** Eşleştirme için gereken minimum envanter alanları (iki dilli adlar dahil). */
export interface MatchableInventoryItem {
  name: string;
  nameTr?: string;
  nameEn?: string;
}

/**
 * Ad normalizasyonu: trim + TR locale küçük harf + aksan/diakritik temizliği
 * (ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u; EN aksanları da NFD ile düşer) +
 * harf/rakam dışı her şey boşluğa.
 */
export function normalizeForMatch(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kaba tekilleştirme: EN çoğul son eki "s" (flakes→flake, peppers→pepper) ve
 * TR çoğul "ler/lar" atılır. Kalan küçük ek farkları (es/ed, iyelik "-su/-si")
 * `tokenMatches`'teki önek kuralıyla yakalanır — agresif kök bulma YAPILMAZ
 * (yanlış pozitif, yanlış negatiften daha zararlı: malzeme "evde var"
 * sanılır).
 */
function stemToken(token: string): string {
  if (token.length >= 6 && (token.endsWith('ler') || token.endsWith('lar'))) {
    return token.slice(0, -3);
  }
  if (token.length >= 4 && token.endsWith('s')) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenize(name: string): string[] {
  return normalizeForMatch(name).split(' ').filter(Boolean).map(stemToken);
}

/**
 * İki token eşleşir mi: birebir eşitlik VEYA kısa olan uzun olanın ÖN EKİ ve
 * fark ≤2 harf ("tursu"↔"tursusu", "pickle"↔"pickled", "egg"↔"eggs").
 * Fark sınırı bilinçli dar — "biber"↔"biberiye" gibi farklı ürünler
 * eşleşmesin (yanlış pozitif riski).
 */
function tokenMatches(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 3 && longer.startsWith(shorter) && longer.length - shorter.length <= 2;
}

/**
 * İki ürün/malzeme adı aynı şeyi mi anlatıyor: bir tarafın TÜM token'ları
 * diğer tarafta karşılık buluyorsa eşleşir ("Domates" ↔ "Cherry Domates",
 * "Fresh Cilantro" ↔ "Cilantro"). Kısmi örtüşme ("Red Pepper Flakes" ↔
 * "Chili Flakes" — sadece "flakes" ortak) EŞLEŞME SAYILMAZ; eş anlamlıları
 * önlemek prompt'un işi (bkz. generateRecipes "ismi AYNEN kullan" kuralı).
 */
export function namesMatch(a: string, b: string): boolean {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) {
    return false;
  }
  const aInB = tokensA.every((ta) => tokensB.some((tb) => tokenMatches(ta, tb)));
  const bInA = tokensB.every((tb) => tokensA.some((ta) => tokenMatches(ta, tb)));
  return aInB || bInA;
}

/** Envanter ürününün verilen dildeki gösterim/prompt adı — karşılık yoksa `name`. */
export function inventoryNameForLanguage(
  item: MatchableInventoryItem,
  language: 'tr' | 'en'
): string {
  return (language === 'tr' ? item.nameTr : item.nameEn) ?? item.name;
}

/**
 * Malzeme adını envanterde arar — HER İKİ dil alanına (name + nameTr +
 * nameEn) karşı. Önce birebir normalize eşitlik (birden çok aday varsa en
 * isabetlisi kazansın), sonra token eşleşmesi.
 */
export function findInventoryMatch<T extends MatchableInventoryItem>(
  ingredientName: string,
  inventory: readonly T[]
): T | null {
  const variants = (item: MatchableInventoryItem) =>
    [item.name, item.nameTr, item.nameEn].filter(
      (name): name is string => typeof name === 'string' && name.trim().length > 0
    );

  const target = normalizeForMatch(ingredientName);
  for (const item of inventory) {
    if (variants(item).some((name) => normalizeForMatch(name) === target)) {
      return item;
    }
  }
  for (const item of inventory) {
    if (variants(item).some((name) => namesMatch(ingredientName, name))) {
      return item;
    }
  }
  return null;
}

/**
 * Deterministik emniyet katmanı (İş 3b): tarif detayı döndükten sonra
 * ingredients[] envanterle eşleştirilir — eşleşen malzeme in_inventory: true
 * yapılır VE adı envanterdeki (aktif dildeki) adla DEĞİŞTİRİLİR. Böylece
 * envanterde "Chili Flakes" varken model "Pul Biber" yazsa bile malzeme asla
 * eksik sayılmaz ve UI'da envanterle aynı adla görünür. Eşleşmeyen malzemeye
 * DOKUNULMAZ (in_inventory alçaltılmaz — kiler malzemelerini model true
 * işaretler, onlar envanterde olmadığı için burada eşleşmez).
 */
export function reconcileIngredientsWithInventory(
  ingredients: readonly RecipeIngredient[],
  inventory: readonly MatchableInventoryItem[],
  language: 'tr' | 'en'
): RecipeIngredient[] {
  return ingredients.map((ingredient) => {
    const match = findInventoryMatch(ingredient.name, inventory);
    if (!match) {
      return { ...ingredient };
    }
    return { ...ingredient, name: inventoryNameForLanguage(match, language), in_inventory: true };
  });
}
