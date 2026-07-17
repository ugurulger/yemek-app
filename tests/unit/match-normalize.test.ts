/**
 * normalizeIngredientQuery birim testleri.
 * Koşum: npx tsx --test tests/unit/match-normalize.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeIngredientQuery } from '../../services/matching/normalize';

test('tr-TR küçük harfe çevirir (İ→i, I→ı)', () => {
  assert.equal(normalizeIngredientQuery('SOĞAN'), 'soğan');
  assert.equal(normalizeIngredientQuery('İncir'), 'incir');
  assert.equal(normalizeIngredientQuery('ISPANAK'), 'ıspanak');
});

test('parantez içini ve noktalama işaretlerini temizler', () => {
  assert.equal(normalizeIngredientQuery('Taze Soğan (2 demet)'), 'taze soğan');
  assert.equal(normalizeIngredientQuery('domates, salçası'), 'domates salçası');
});

test('fazla boşlukları daraltır ve kırpar', () => {
  assert.equal(normalizeIngredientQuery('  pul   biber  '), 'pul biber');
});

test('boş/sadece noktalama girdisinde boş string döner', () => {
  assert.equal(normalizeIngredientQuery('()..'), '');
});
