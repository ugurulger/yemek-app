/**
 * categorizeIngredient birim testleri — asistanla ekleme kategori düzeltmesi
 * (kullanıcı bug bildirimi: patlıcan "Diğer"e, nohut "Buzdolabı > Diğer"e
 * düşüyordu). Koşum: npx tsx --test tests/unit/categorize.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { categorizeIngredient } from '../../lib/inventory/categorize';

test('bildirilen buglar: patlıcan sebzeye, nohut kiler bakliyatına gider', () => {
  assert.deepEqual(categorizeIngredient('Patlıcan'), {
    inventoryCategory: 'Meyve & Sebze',
    pantryCategory: null,
  });
  assert.deepEqual(categorizeIngredient('Nohut'), {
    inventoryCategory: 'Diğer',
    pantryCategory: 'Bakliyat & Makarna',
  });
});

test('20+ yaygın malzeme doğru kategoriye atanır (deterministik eşleme)', () => {
  const expectInventory = (name: string, category: string) => {
    const result = categorizeIngredient(name);
    assert.equal(result.inventoryCategory, category, `${name} → ${category} bekleniyordu`);
    assert.equal(result.pantryCategory, null, `${name} kilere yönlenmemeli`);
  };
  const expectPantry = (name: string) => {
    const result = categorizeIngredient(name);
    assert.equal(
      result.pantryCategory,
      'Bakliyat & Makarna',
      `${name} → kiler Bakliyat & Makarna bekleniyordu`
    );
  };

  // Sebze & meyve
  expectInventory('Patlıcan', 'Meyve & Sebze');
  expectInventory('Domates', 'Meyve & Sebze');
  expectInventory('Cherry Domates', 'Meyve & Sebze');
  expectInventory('Yeşil Biber', 'Meyve & Sebze');
  expectInventory('Salatalık', 'Meyve & Sebze');
  expectInventory('Taze Fasulye', 'Meyve & Sebze');
  expectInventory('Elma', 'Meyve & Sebze');
  expectInventory('Muz', 'Meyve & Sebze');
  expectInventory('Avokado', 'Meyve & Sebze');
  // Et / tavuk / balık / yumurta
  expectInventory('Kıyma', 'Şarküteri');
  expectInventory('Tavuk Göğsü', 'Şarküteri');
  expectInventory('Somon', 'Şarküteri');
  expectInventory('Ton Balığı', 'Şarküteri');
  expectInventory('Yumurta', 'Şarküteri');
  expectInventory('Sucuk', 'Şarküteri');
  // Süt & peynir
  expectInventory('Süt', 'Süt Ürünleri');
  expectInventory('Süzme Yoğurt', 'Süt Ürünleri');
  expectInventory('Tereyağı', 'Süt Ürünleri');
  expectInventory('Kaşar Peyniri', 'Peynir');
  expectInventory('Beyaz Peynir', 'Peynir');
  expectInventory('Hellim', 'Peynir');
  // Bakliyat & tahıl → Temel Malzemeler (kiler)
  expectPantry('Nohut');
  expectPantry('Kırmızı Mercimek');
  expectPantry('Kuru Fasulye');
  expectPantry('Pirinç');
  expectPantry('Makarna');
  expectPantry('Bulgur');
  // Sos & baharat
  expectInventory('Salça', 'Sos & Baharat');
  expectInventory('Karabiber', 'Sos & Baharat');
  expectInventory('Pul Biber', 'Sos & Baharat');
  expectInventory('Zeytinyağı', 'Sos & Baharat');
  expectInventory('Turşu', 'Sos & Baharat');
});

test('çok kelimeli anahtar tek kelimeliyi ezer: kuru fasulye ≠ taze fasulye', () => {
  assert.equal(categorizeIngredient('Kuru Fasulye').pantryCategory, 'Bakliyat & Makarna');
  assert.equal(categorizeIngredient('Fasulye').inventoryCategory, 'Meyve & Sebze');
});

test('bitişik kelimeler yanlış eşleşmez: karabiber sebze DEĞİL baharattır', () => {
  assert.equal(categorizeIngredient('Karabiber').inventoryCategory, 'Sos & Baharat');
  assert.equal(categorizeIngredient('Toz Kırmızı Biber').inventoryCategory, 'Sos & Baharat');
});

test('tanınmayan ad: AI kategorisi kullanılır, o da yoksa Diğer', () => {
  assert.equal(categorizeIngredient('Acayip Egzotik Ürün', 'Sebze').inventoryCategory, 'Meyve & Sebze');
  assert.deepEqual(categorizeIngredient('Acayip Egzotik Ürün', 'Bakliyat & Tahıl'), {
    inventoryCategory: 'Diğer',
    pantryCategory: 'Bakliyat & Makarna',
  });
  assert.equal(categorizeIngredient('Acayip Egzotik Ürün').inventoryCategory, 'Diğer');
  assert.equal(categorizeIngredient('Acayip Egzotik Ürün', 'uydurma-kategori').inventoryCategory, 'Diğer');
});

test('deterministik eşleme AI kategorisini ezer (model yanılsa da patlıcan sebzedir)', () => {
  assert.equal(categorizeIngredient('Patlıcan', 'Diğer').inventoryCategory, 'Meyve & Sebze');
  assert.equal(categorizeIngredient('Nohut', 'Sebze').pantryCategory, 'Bakliyat & Makarna');
});

test('Türkçe ekler önek eşleşmesiyle tolere edilir', () => {
  assert.equal(categorizeIngredient('Tulum Peyniri').inventoryCategory, 'Peynir');
  assert.equal(categorizeIngredient('ton balığı').inventoryCategory, 'Şarküteri');
});
