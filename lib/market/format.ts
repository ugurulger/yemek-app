/** Fiyat biçimleme — euro cent → "€1,29" (virgüllü, TR/NL alışkanlığı). */

export function formatPriceCents(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}
