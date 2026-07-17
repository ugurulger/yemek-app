/**
 * Malzeme adı normalizasyonu — eşleştirme motorunun ve Tier-0 cache
 * anahtarlarının tek gerçek kaynağı. `lib/recipes/recipe-math.ts`
 * `normalizeIngredientName` (tr-TR küçük harf) + vision-eval `normalizeName`
 * (NFC, noktalama temizliği) sentezidir.
 */

/**
 * tr-TR küçük harf + NFC + parantez içlerini at + noktalama → boşluk +
 * boşluk daralt. Örn. "Taze  Soğan (2 demet)" → "taze soğan".
 */
export function normalizeIngredientQuery(name: string): string {
  return name
    .normalize('NFC')
    .toLocaleLowerCase('tr-TR')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[().,;:/\\!?"'’`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
