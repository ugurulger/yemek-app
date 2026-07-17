/**
 * Mock sağlayıcının sabit ürün kataloğu. GERÇEK AH/Jumbo verisi değildir;
 * fiyatlar temsilidir. Web önizlemesinde (CORS) ve testlerde kullanılır.
 *
 * Kapsam: TR→NL sözlüğündeki en yaygın malzemeler + bilerek bir adet
 * FİYATSIZ ürün ("fiyat alınamadı" UI yolunu canlı tutmak için — AH'deki
 * "Verse kruiden mix").
 */

import type { StoreId, StoreProduct } from '../types';

interface MockSeed {
  sku: string;
  name: string;
  brand?: string;
  /** euro cent; null = bilerek fiyatsız. */
  priceCents: number | null;
  unitSize?: string;
}

const AH_SEEDS: MockSeed[] = [
  { sku: '100001', name: 'AH Uien', brand: 'AH', priceCents: 119, unitSize: '1 kg' },
  { sku: '100002', name: 'AH Rundergehakt', brand: 'AH', priceCents: 449, unitSize: '500 g' },
  { sku: '100003', name: 'AH Tomatenpuree', brand: 'AH', priceCents: 79, unitSize: '70 g' },
  { sku: '100004', name: 'AH Goudse kaas jong belegen stuk', brand: 'AH', priceCents: 649, unitSize: '450 g' },
  { sku: '100005', name: 'AH Halfvolle melk', brand: 'AH', priceCents: 135, unitSize: '1 l' },
  { sku: '100006', name: 'AH Scharreleieren M', brand: 'AH', priceCents: 329, unitSize: '10 stuks' },
  { sku: '100007', name: 'AH Kipfilet', brand: 'AH', priceCents: 599, unitSize: '600 g' },
  { sku: '100008', name: 'AH Basmatirijst', brand: 'AH', priceCents: 289, unitSize: '1 kg' },
  { sku: '100009', name: 'AH Spaghetti', brand: 'AH', priceCents: 129, unitSize: '500 g' },
  { sku: '100010', name: 'AH Kruimige aardappelen', brand: 'AH', priceCents: 249, unitSize: '2.5 kg' },
  { sku: '100011', name: 'AH Rode paprika', brand: 'AH', priceCents: 99, unitSize: 'per stuk' },
  { sku: '100012', name: 'AH Trostomaten', brand: 'AH', priceCents: 219, unitSize: '500 g' },
  { sku: '100013', name: 'AH Komkommer', brand: 'AH', priceCents: 109, unitSize: 'per stuk' },
  { sku: '100014', name: 'AH Knoflook', brand: 'AH', priceCents: 139, unitSize: '3 stuks' },
  { sku: '100015', name: 'AH Roomboter ongezouten', brand: 'AH', priceCents: 269, unitSize: '250 g' },
  { sku: '100016', name: 'AH Volle yoghurt', brand: 'AH', priceCents: 189, unitSize: '1 l' },
  { sku: '100017', name: 'AH Tarwebloem', brand: 'AH', priceCents: 115, unitSize: '1 kg' },
  { sku: '100018', name: 'AH Kristalsuiker', brand: 'AH', priceCents: 149, unitSize: '1 kg' },
  { sku: '100019', name: 'AH Olijfolie extra vierge', brand: 'AH', priceCents: 699, unitSize: '500 ml' },
  { sku: '100020', name: 'AH Citroenen', brand: 'AH', priceCents: 179, unitSize: '4 stuks' },
  { sku: '100021', name: 'Verse kruiden mix', brand: 'AH', priceCents: null, unitSize: '30 g' },
  { sku: '100022', name: 'Santa Maria Chilivlokken', brand: 'Santa Maria', priceCents: 259, unitSize: '26 g' },
  { sku: '100023', name: 'AH Filodeeg', brand: 'AH', priceCents: 319, unitSize: '270 g' },
  { sku: '100024', name: 'Yildiz Sucuk', brand: 'Yildiz', priceCents: 429, unitSize: '250 g' },
  { sku: '100025', name: 'AH Witte kaas blokjes', brand: 'AH', priceCents: 299, unitSize: '200 g' },
  { sku: '100026', name: 'AH Rode linzen', brand: 'AH', priceCents: 199, unitSize: '400 g' },
  { sku: '100027', name: 'AH Kikkererwten', brand: 'AH', priceCents: 109, unitSize: '400 g' },
];

const JUMBO_SEEDS: MockSeed[] = [
  { sku: '200001', name: 'Jumbo Uien', brand: 'Jumbo', priceCents: 109, unitSize: '1 kg' },
  { sku: '200002', name: 'Jumbo Rundergehakt', brand: 'Jumbo', priceCents: 429, unitSize: '500 g' },
  { sku: '200003', name: 'Jumbo Tomatenpuree', brand: 'Jumbo', priceCents: 72, unitSize: '70 g' },
  { sku: '200004', name: 'Jumbo Goudse kaas jong belegen', brand: 'Jumbo', priceCents: 679, unitSize: '450 g' },
  { sku: '200005', name: 'Jumbo Halfvolle melk', brand: 'Jumbo', priceCents: 129, unitSize: '1 l' },
  { sku: '200006', name: 'Jumbo Scharreleieren M', brand: 'Jumbo', priceCents: 339, unitSize: '10 stuks' },
  { sku: '200007', name: 'Jumbo Kipfilet', brand: 'Jumbo', priceCents: 579, unitSize: '600 g' },
  { sku: '200008', name: 'Jumbo Basmatirijst', brand: 'Jumbo', priceCents: 299, unitSize: '1 kg' },
  { sku: '200009', name: 'Jumbo Spaghetti', brand: 'Jumbo', priceCents: 119, unitSize: '500 g' },
  { sku: '200010', name: 'Jumbo Kruimige aardappelen', brand: 'Jumbo', priceCents: 259, unitSize: '2.5 kg' },
  { sku: '200011', name: 'Jumbo Rode paprika', brand: 'Jumbo', priceCents: 95, unitSize: 'per stuk' },
  { sku: '200012', name: 'Jumbo Trostomaten', brand: 'Jumbo', priceCents: 229, unitSize: '500 g' },
  { sku: '200013', name: 'Jumbo Komkommer', brand: 'Jumbo', priceCents: 99, unitSize: 'per stuk' },
  { sku: '200014', name: 'Jumbo Knoflook', brand: 'Jumbo', priceCents: 129, unitSize: '3 stuks' },
  { sku: '200015', name: 'Jumbo Roomboter ongezouten', brand: 'Jumbo', priceCents: 259, unitSize: '250 g' },
  { sku: '200016', name: 'Jumbo Volle yoghurt', brand: 'Jumbo', priceCents: 179, unitSize: '1 l' },
  { sku: '200017', name: 'Jumbo Tarwebloem', brand: 'Jumbo', priceCents: 109, unitSize: '1 kg' },
  { sku: '200018', name: 'Jumbo Kristalsuiker', brand: 'Jumbo', priceCents: 155, unitSize: '1 kg' },
  { sku: '200019', name: 'Jumbo Olijfolie extra vierge', brand: 'Jumbo', priceCents: 649, unitSize: '500 ml' },
  { sku: '200020', name: 'Jumbo Citroenen', brand: 'Jumbo', priceCents: 189, unitSize: '4 stuks' },
  { sku: '200021', name: 'Jumbo Verse peterselie', brand: 'Jumbo', priceCents: 129, unitSize: '30 g' },
  { sku: '200022', name: 'Verstegen Chilivlokken', brand: 'Verstegen', priceCents: 279, unitSize: '15 g' },
  { sku: '200023', name: 'Jumbo Filodeeg', brand: 'Jumbo', priceCents: 329, unitSize: '270 g' },
  { sku: '200024', name: 'Egeturk Sucuk', brand: 'Egeturk', priceCents: 449, unitSize: '250 g' },
  { sku: '200025', name: 'Jumbo Witte kaas', brand: 'Jumbo', priceCents: 289, unitSize: '200 g' },
  { sku: '200026', name: 'Jumbo Rode linzen', brand: 'Jumbo', priceCents: 189, unitSize: '400 g' },
  { sku: '200027', name: 'Jumbo Kikkererwten', brand: 'Jumbo', priceCents: 99, unitSize: '400 g' },
];

function toProducts(storeId: StoreId, seeds: MockSeed[]): StoreProduct[] {
  return seeds.map((seed) => ({
    storeId,
    sku: seed.sku,
    name: seed.name,
    brand: seed.brand,
    priceCents: seed.priceCents,
    unitSize: seed.unitSize,
    webUrl:
      storeId === 'ah'
        ? `https://www.ah.nl/producten/product/wi${seed.sku}`
        : `https://www.jumbo.com/producten/${seed.sku}`,
  }));
}

export const MOCK_PRODUCTS: Record<StoreId, StoreProduct[]> = {
  ah: toProducts('ah', AH_SEEDS),
  jumbo: toProducts('jumbo', JUMBO_SEEDS),
};
