/**
 * prepare-dataset normalize fonksiyonlarının birim testleri.
 * Koşum: npx tsx --test tests/unit/prepare-dataset.test.ts
 * (test çatısı bağımlılığı YOK — Node'un yerleşik test runner'ı + tsx.)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normalizeIngredient,
  parseDurationMinutes,
  splitSteps,
} from '../../scripts/prepare-dataset';

test('pound → gram dönüşümü', () => {
  const result = normalizeIngredient('1 pound tri-colored spiral pasta');
  assert.equal(result?.qty, 455);
  assert.equal(result?.unit, 'g');
  assert.equal(result?.name, 'tri-colored spiral pasta');
});

test('cup → ml dönüşümü (unicode kesir)', () => {
  const result = normalizeIngredient('½ cup milk, divided');
  assert.equal(result?.qty, 120);
  assert.equal(result?.unit, 'ml');
  assert.equal(result?.name, 'milk');
});

test('ascii kesir tek başına (1/2 cup)', () => {
  const result = normalizeIngredient('1/2 cup shredded cheddar cheese');
  assert.equal(result?.qty, 120);
  assert.equal(result?.unit, 'ml');
});

test('karışık sayı (1 1/2 pounds)', () => {
  const result = normalizeIngredient('1 1/2 pounds ground beef');
  assert.equal(result?.qty, 680);
  assert.equal(result?.unit, 'g');
});

test('parantezli kap boyutu metriğe çevrilir', () => {
  const result = normalizeIngredient('5 (13.75 ounce) cans chicken broth');
  assert.equal(result?.qty, 5);
  assert.equal(result?.unit, 'can');
  assert.ok(result?.text.includes('(385 g)'));
  assert.equal(result?.name, 'chicken broth');
});

test('adet benzeri birimler korunur, hazırlık notu addan atılır', () => {
  const result = normalizeIngredient('2 cloves garlic, minced');
  assert.equal(result?.unit, 'clove');
  assert.equal(result?.name, 'garlic');
});

test('birimsiz satır olduğu gibi kalır', () => {
  const result = normalizeIngredient('salt and pepper to taste');
  assert.equal(result?.qty, null);
  assert.equal(result?.unit, null);
});

test('süre ayrıştırma', () => {
  assert.equal(parseDurationMinutes('20 mins'), 20);
  assert.equal(parseDurationMinutes('1 hr 25 mins'), 85);
  assert.equal(parseDurationMinutes('13 hrs 55 mins'), 835);
  assert.equal(parseDurationMinutes(''), null);
  assert.equal(parseDurationMinutes(null), null);
});

test('adım bölme: cümle sınırları', () => {
  assert.deepEqual(splitSteps('Cook pasta. Drain well. Serve cold.'), [
    'Cook pasta.',
    'Drain well.',
    'Serve cold.',
  ]);
});

test('adım bölme: satır sonları öncelikli', () => {
  assert.deepEqual(splitSteps('Preheat oven to 175 C.\nBake for 30 minutes.'), [
    'Preheat oven to 175 C.',
    'Bake for 30 minutes.',
  ]);
});
