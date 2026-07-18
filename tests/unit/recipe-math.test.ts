/**
 * computeMissing / scaleServings birim testleri (orkestrasyon Faz 4).
 * Koşum: npx tsx --test tests/unit/recipe-math.test.ts
 * (test çatısı bağımlılığı YOK — Node'un yerleşik test runner'ı + tsx.)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  computeMissing,
  formatQty,
  normalizeIngredientName,
  scaleQty,
  scaleServings,
} from '../../lib/recipes/recipe-math';
import type { Recipe, RecipeIngredient } from '../../types/recipe';

function ing(name: string, overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    name,
    qty: 100,
    unit: 'g',
    kcal: 50,
    category: 'Diğer',
    in_inventory: false,
    ...overrides,
  };
}

function recipe(ingredients: RecipeIngredient[], servings = 2): Recipe {
  return {
    id: 'r1',
    name: 'Test Tarifi',
    emoji: '🍲',
    kcal: 400,
    servings,
    time_min: 30,
    difficulty: 'Kolay',
    macros: { protein: 20, karb: 30, yag: 10 },
    match_pct: 50,
    ingredients,
    missing_count: 0,
    steps: ['Pişir.'],
    chef_tip: 'Afiyet olsun.',
    nutrition_tag: 'Dengeli',
  };
}

const inv = (...names: string[]) => names.map((name) => ({ name }));
const pantry = (...names: string[]) => names.map((name) => ({ name, active: true }));

test('computeMissing: envanterdeki ve aktif kilerdeki malzemeler eksik sayılmaz', () => {
  const r = recipe([ing('Domates'), ing('Tuz'), ing('Krema')]);
  const missing = computeMissing(r, inv('Domates'), pantry('Tuz'));
  assert.deepEqual(
    missing.map((m) => m.name),
    ['Krema']
  );
});

test('computeMissing: eşleşme büyük/küçük harfe ve Türkçe karaktere duyarsız', () => {
  const r = recipe([ing('SÜT'), ing('Kaşar Peyniri')]);
  const missing = computeMissing(r, inv('süt', 'kaşar peyniri'), []);
  assert.equal(missing.length, 0);
});

test('computeMissing: kelime içerme eşleşmesi çift yönlü çalışır (domates ↔ cherry domates)', () => {
  const r = recipe([ing('Domates'), ing('Cherry Domates')]);
  const missing = computeMissing(r, inv('Cherry Domates'), []);
  // "Domates" cherry domates içinde geçer, "Cherry Domates" birebir eşleşir.
  assert.equal(missing.length, 0);
});

test('computeMissing: farklı dil/eş anlamlı ad, iki dilli genişletilmiş envanterle eşleşir (İş 3)', () => {
  // expandInventoryForMatching (src/i18n/inventoryI18n.ts) her ürünü bilinen
  // TÜM dillerdeki adlarıyla ayrı satırlar olarak verir — TR tarif malzemesi
  // "Pul Biber", envanterdeki "Chili Flakes" ürününün nameTr varyantıyla
  // eşleşir; tekil/çoğul farkı da tolere edilir.
  const r = recipe([ing('Pul Biber'), ing('Pickled Jalapeno'), ing('Taze Kişniş')]);
  const missing = computeMissing(
    r,
    inv('Chili Flakes', 'Pul Biber', 'Pickled Jalapenos', 'Jalapeno Turşusu'),
    []
  );
  assert.deepEqual(
    missing.map((m) => m.name),
    ['Taze Kişniş']
  );
});

test('computeMissing: eski ham substring yanlış pozitifi düzeldi ("un" ⊂ "sabun")', () => {
  const r = recipe([ing('Un')]);
  assert.equal(computeMissing(r, inv('Sabun'), []).length, 1);
});

test('computeMissing: PASİF kiler malzemesi eksik sayılır', () => {
  const r = recipe([ing('Tuz')]);
  const missing = computeMissing(r, [], [{ name: 'Tuz', active: false }]);
  assert.deepEqual(
    missing.map((m) => m.name),
    ['Tuz']
  );
});

test('computeMissing: boş envanter + boş kiler → tüm malzemeler eksik', () => {
  const r = recipe([ing('Un'), ing('Su')]);
  assert.equal(computeMissing(r, [], []).length, 2);
});

test("computeMissing: in_inventory bayrağından BAĞIMSIZ, canlı listeye bakar", () => {
  // Model üretim anında true işaretlemiş olsa da ürün artık envanterde yok.
  const r = recipe([ing('Krema', { in_inventory: true })]);
  assert.equal(computeMissing(r, [], []).length, 1);
});

test('scaleServings: miktar ve tekil kcal orantılanır, orijinal değişmez', () => {
  const r = recipe([ing('Tavuk', { qty: 400, kcal: 440 })], 2);
  const scaled = scaleServings(r, 4);
  assert.equal(scaled.servings, 4);
  assert.equal(scaled.ingredients[0].scaledQty, 800);
  assert.equal(scaled.ingredients[0].scaledKcal, 880);
  // Orijinal tarif nesnesi değişmedi:
  assert.equal(r.ingredients[0].qty, 400);
});

test('scaleServings: kalori ve makrolar malzemelerle AYNI çarpanla ölçeklenir', () => {
  const r = recipe([ing('Tavuk')], 2); // kcal 400, protein 20, karb 30, yağ 10
  const doubled = scaleServings(r, 4);
  assert.equal(doubled.kcal, 800);
  assert.deepEqual(doubled.macros, { protein: 40, karb: 60, yag: 20 });
  const halved = scaleServings(r, 1);
  assert.equal(halved.kcal, 200);
  assert.deepEqual(halved.macros, { protein: 10, karb: 15, yag: 5 });
  // Orijinal tarif nesnesi değişmedi:
  assert.equal(r.kcal, 400);
  assert.equal(r.macros.protein, 20);
});

test('scaleServings: küçültme yönü ve yuvarlama (2→1 kişi)', () => {
  const r = recipe([ing('Süt', { qty: 1, unit: 'su bardağı', kcal: 90 })], 2);
  const scaled = scaleServings(r, 1);
  assert.equal(scaled.ingredients[0].scaledQty, 0.5);
  assert.equal(scaled.ingredients[0].scaledKcal, 45);
});

test('scaleServings: geçersiz hedef (0/negatif) 1 kişiye sabitlenir', () => {
  const r = recipe([ing('Un', { qty: 200, kcal: 700 })], 2);
  assert.equal(scaleServings(r, 0).servings, 1);
  assert.equal(scaleServings(r, -3).servings, 1);
});

test('scaleQty: insan-okur yuvarlama kademeleri', () => {
  assert.equal(scaleQty(1, 4, 1), 0.25); // <1 → iki ondalık
  assert.equal(scaleQty(3, 2, 3), 4.5); // <10 → bir ondalık
  assert.equal(scaleQty(250, 2, 3), 375); // ≥10 → tam sayı
  assert.equal(scaleQty(5, 0, 3), 5); // geçersiz taban → değişmez
});

test('formatQty: Türkçe ondalık ayracı', () => {
  assert.equal(formatQty(0.5), '0,5');
  assert.equal(formatQty(375), '375');
});

test('normalizeIngredientName: Türkçe locale küçültme + trim', () => {
  assert.equal(normalizeIngredientName('  SÜT '), 'süt');
  assert.equal(normalizeIngredientName('Kıyma'), 'kıyma');
});
