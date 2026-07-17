/**
 * scoreProduct / parseUnitSize birim testleri.
 * Koşum: npx tsx --test tests/unit/match-fuzzy.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FUZZY_ACCEPT_THRESHOLD, parseUnitSize, scoreProduct } from '../../services/matching/fuzzy';
import type { StoreProduct } from '../../services/stores/types';

function product(name: string, unitSize?: string): StoreProduct {
  return { storeId: 'ah', sku: '1', name, priceCents: 100, unitSize };
}

test('parseUnitSize: temel biçimler', () => {
  assert.deepEqual(parseUnitSize('500 g'), { kind: 'mass', amount: 500 });
  assert.deepEqual(parseUnitSize('1.5 liter'), { kind: 'volume', amount: 1500 });
  assert.deepEqual(parseUnitSize('2 L'), { kind: 'volume', amount: 2000 });
  assert.deepEqual(parseUnitSize('4 x 140 g'), { kind: 'mass', amount: 560 });
  assert.deepEqual(parseUnitSize('10 stuks'), { kind: 'count', amount: 10 });
  assert.deepEqual(parseUnitSize('per stuk'), { kind: 'count', amount: 1 });
  assert.equal(parseUnitSize('ca. vers'), null);
});

test('doğrudan eşleşme eşik üstü skorlar', () => {
  const score = scoreProduct('uien', [], { qty: 2, unit: 'adet' }, product('AH Gele uien', '3 stuks'));
  assert.ok(score >= FUZZY_ACCEPT_THRESHOLD, `skor düşük: ${score}`);
});

test('türev ürün ("uiensoep") ceza alır ve eşiğin altında kalır', () => {
  const direct = scoreProduct('uien', [], { qty: 2, unit: 'adet' }, product('AH Gele uien', '3 stuks'));
  const derived = scoreProduct('uien', [], { qty: 2, unit: 'adet' }, product('AH Uiensoep', '570 ml'));
  assert.ok(derived < direct, `türev (${derived}) < doğrudan (${direct}) olmalı`);
  assert.ok(derived < FUZZY_ACCEPT_THRESHOLD, `türev ürün eşik altında kalmalı: ${derived}`);
});

test('matchHints bonusu ipuçlu ürünü öne çıkarır', () => {
  const hinted = scoreProduct(
    'gehakt',
    ['rundergehakt'],
    { qty: 500, unit: 'g' },
    product('AH Rundergehakt', '500 g')
  );
  const unhinted = scoreProduct(
    'gehakt',
    ['rundergehakt'],
    { qty: 500, unit: 'g' },
    product('Verstegen Mix voor Gehakt', '225 g')
  );
  assert.ok(hinted > unhinted, `ipuçlu (${hinted}) > ipuçsuz (${unhinted}) olmalı`);
});

test('alakasız ürün 0 skorlar', () => {
  assert.equal(scoreProduct('uien', [], { qty: 1, unit: 'adet' }, product('Cola Zero', '1.5 l')), 0);
});

test('absürt paket boyutu makul boyuttan düşük skorlar', () => {
  const sane = scoreProduct('rijst', [], { qty: 200, unit: 'g' }, product('Jumbo Basmatirijst', '1 kg'));
  const absurd = scoreProduct('rijst', [], { qty: 200, unit: 'g' }, product('Jumbo Basmatirijst', '10 kg'));
  assert.ok(sane > absurd, `makul (${sane}) > absürt (${absurd}) olmalı`);
});

test('mutfak ölçüsü birimlerde (yk, su bardağı) birim puanı atlanır ama eşleşme çalışır', () => {
  const score = scoreProduct('tomatenpuree', [], { qty: 2, unit: 'yk' }, product('AH Tomatenpuree', '70 g'));
  assert.ok(score >= FUZZY_ACCEPT_THRESHOLD, `skor düşük: ${score}`);
});
