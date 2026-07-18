/**
 * İş 3b — envanter ↔ tarif malzemesi normalize eşleştirme testleri.
 * Koşum: npx tsx --test tests/unit/ingredient-match.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  findInventoryMatch,
  inventoryNameForLanguage,
  namesMatch,
  normalizeForMatch,
  reconcileIngredientsWithInventory,
} from '../../lib/recipes/ingredient-match';
import type { RecipeIngredient } from '../../types/recipe';

function ing(name: string, inInventory = false): RecipeIngredient {
  return { name, qty: 1, unit: 'adet', kcal: 10, category: 'Diğer', in_inventory: inInventory };
}

test('normalizeForMatch: küçük harf + aksan/diakritik + noktalama temizliği', () => {
  assert.equal(normalizeForMatch('  Kaşar Peyniri '), 'kasar peyniri');
  assert.equal(normalizeForMatch('SÜT'), 'sut');
  assert.equal(normalizeForMatch('Jalapeño (turşu)'), 'jalapeno tursu');
  assert.equal(normalizeForMatch('IĞDIR Kayısısı'), 'igdir kayisisi');
});

test('namesMatch: birebir ve büyük/küçük/aksan farkıyla eşleşir', () => {
  assert.ok(namesMatch('Süt', 'süt'));
  assert.ok(namesMatch('Kaşar Peyniri', 'KAŞAR PEYNİRİ'));
});

test('namesMatch: token alt-küme kuralı çift yönlü ("domates" ↔ "cherry domates")', () => {
  assert.ok(namesMatch('Domates', 'Cherry Domates'));
  assert.ok(namesMatch('Cherry Domates', 'Domates'));
  assert.ok(namesMatch('Fresh Cilantro', 'Cilantro'));
});

test('namesMatch: tekil/çoğul ve küçük ek farkları eşleşir', () => {
  assert.ok(namesMatch('Pickled Jalapeno', 'Pickled Jalapenos'));
  assert.ok(namesMatch('Chili Flake', 'Chili Flakes'));
  assert.ok(namesMatch('Egg', 'Eggs'));
  assert.ok(namesMatch('Domates', 'Domatesler'));
  assert.ok(namesMatch('Turşu', 'Turşusu'));
});

test('namesMatch: kısmi token örtüşmesi EŞLEŞME DEĞİL (eş anlamlıyı prompt çözer)', () => {
  // Yalnızca "flakes" ortak — farklı adlandırma, lexical eşleşme beklenmez.
  assert.ok(!namesMatch('Red Pepper Flakes', 'Chili Flakes'));
  assert.ok(!namesMatch('Salam', 'Salata'));
  assert.ok(!namesMatch('Biber', 'Biberiye'));
});

test('namesMatch: eski substring yanlış pozitifleri artık eşleşmez ("un" ⊂ "sabun")', () => {
  assert.ok(!namesMatch('Un', 'Sabun'));
  assert.ok(!namesMatch('Nane', 'Ananas'));
});

test('findInventoryMatch: her iki dil alanına (name/nameTr/nameEn) bakar', () => {
  const inventory = [
    { name: 'Pickled Jalapenos', nameTr: 'Jalapeno Turşusu', nameEn: 'Pickled Jalapenos' },
    { name: 'Chili Flakes', nameTr: 'Pul Biber', nameEn: 'Chili Flakes' },
  ];
  // TR üretilmiş tarif malzemesi, envanterin nameTr alanıyla eşleşir.
  assert.equal(findInventoryMatch('Pul Biber', inventory), inventory[1]);
  // EN ad, EN alanla eşleşir (tekil/çoğul toleransı dahil).
  assert.equal(findInventoryMatch('pickled jalapeno', inventory), inventory[0]);
  // Eşleşmeyen gerçek eksik null döner.
  assert.equal(findInventoryMatch('Taze Kişniş', inventory), null);
});

test('findInventoryMatch: birebir eşitlik, token eşleşmesinden ÖNCE gelir', () => {
  const inventory = [
    { name: 'Cherry Domates' }, // token kuralıyla "Domates"le de eşleşirdi
    { name: 'Domates' },
  ];
  assert.equal(findInventoryMatch('Domates', inventory), inventory[1]);
});

test('inventoryNameForLanguage: dil karşılığı, yoksa name fallback', () => {
  const item = { name: 'Chili Flakes', nameTr: 'Pul Biber', nameEn: 'Chili Flakes' };
  assert.equal(inventoryNameForLanguage(item, 'tr'), 'Pul Biber');
  assert.equal(inventoryNameForLanguage(item, 'en'), 'Chili Flakes');
  assert.equal(inventoryNameForLanguage({ name: 'Süt' }, 'en'), 'Süt');
});

test('reconcile: gözlenen senaryo — eş anlamlı/karşı dil adları envanter adına çevrilir', () => {
  // Envanter: Pickled Jalapenos + Chili Flakes (iki dilli). Tarif (EN üretim)
  // modelin farklı adlarla döndürdüğü malzemeler içeriyor.
  const inventory = [
    { name: 'Pickled Jalapenos', nameTr: 'Jalapeno Turşusu', nameEn: 'Pickled Jalapenos' },
    { name: 'Chili Flakes', nameTr: 'Pul Biber', nameEn: 'Chili Flakes' },
  ];
  const ingredients = [
    ing('Pickled Jalapeno'), // tekil yazım → envanter adına düzeltilir
    ing('Pul Biber'), // karşı dil (TR) adı → nameTr üzerinden eşleşir
    ing('Fresh Cilantro'), // gerçek eksik → dokunulmaz
  ];

  const reconciled = reconcileIngredientsWithInventory(ingredients, inventory, 'en');
  assert.deepEqual(
    reconciled.map((entry) => ({ name: entry.name, in_inventory: entry.in_inventory })),
    [
      { name: 'Pickled Jalapenos', in_inventory: true },
      { name: 'Chili Flakes', in_inventory: true },
      { name: 'Fresh Cilantro', in_inventory: false },
    ]
  );
  // Orijinal dizi değişmedi (saf fonksiyon).
  assert.equal(ingredients[0].name, 'Pickled Jalapeno');
  assert.equal(ingredients[0].in_inventory, false);
});

test('reconcile: aktif dil TR ise ad envanterin TR adıyla değiştirilir', () => {
  const inventory = [{ name: 'Chili Flakes', nameTr: 'Pul Biber', nameEn: 'Chili Flakes' }];
  const reconciled = reconcileIngredientsWithInventory([ing('chili flakes')], inventory, 'tr');
  assert.equal(reconciled[0].name, 'Pul Biber');
  assert.equal(reconciled[0].in_inventory, true);
});

test('reconcile: in_inventory ALÇALTILMAZ (kiler malzemesi envanterde yoksa bile)', () => {
  // Model kiler malzemesini true işaretledi; envanterde karşılığı yok —
  // emniyet katmanı bayrağı geri çekmez.
  const reconciled = reconcileIngredientsWithInventory([ing('Tuz', true)], [], 'tr');
  assert.equal(reconciled[0].in_inventory, true);
  assert.equal(reconciled[0].name, 'Tuz');
});
