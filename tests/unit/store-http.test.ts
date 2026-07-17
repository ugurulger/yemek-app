/**
 * createStoreFetcher (timeout/retry/seri kuyruk) birim testleri.
 * Koşum: npx tsx --test tests/unit/store-http.test.ts
 * (test çatısı bağımlılığı YOK — Node'un yerleşik test runner'ı + tsx.)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createStoreFetcher, type FetchLike } from '../../services/stores/http';
import { StoreApiError } from '../../services/stores/types';

const FAST_BACKOFF = [1, 1] as const;

function okResponse(body = '{}'): Response {
  return new Response(body, { status: 200 });
}

test('başarılı yanıt aynen döner', async () => {
  const fetcher = createStoreFetcher('ah', { minIntervalMs: 0 }, async () => okResponse('{"a":1}'));
  const response = await fetcher('https://example.test');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { a: 1 });
});

test('ağ hatasında retry yapar, sonunda başarır', async () => {
  let calls = 0;
  const flaky: FetchLike = async () => {
    calls += 1;
    if (calls < 3) {
      throw new Error('ECONNRESET');
    }
    return okResponse();
  };
  const fetcher = createStoreFetcher('ah', { retries: 2, minIntervalMs: 0, backoffMs: FAST_BACKOFF }, flaky);
  const response = await fetcher('https://example.test');
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});

test('retry hakkı bitince StoreApiError(network) fırlatır', async () => {
  let calls = 0;
  const failing: FetchLike = async () => {
    calls += 1;
    throw new Error('offline');
  };
  const fetcher = createStoreFetcher('jumbo', { retries: 2, minIntervalMs: 0, backoffMs: FAST_BACKOFF }, failing);
  await assert.rejects(fetcher('https://example.test'), (error: unknown) => {
    assert.ok(error instanceof StoreApiError);
    assert.equal(error.storeId, 'jumbo');
    assert.equal(error.kind, 'network');
    return true;
  });
  assert.equal(calls, 3); // 1 asıl + 2 retry
});

test('5xx ve 429 retry edilir', async () => {
  let calls = 0;
  const statuses = [503, 429];
  const flaky: FetchLike = async () => {
    calls += 1;
    const status = statuses.shift();
    return status ? new Response('err', { status }) : okResponse();
  };
  const fetcher = createStoreFetcher('ah', { retries: 2, minIntervalMs: 0, backoffMs: FAST_BACKOFF }, flaky);
  const response = await fetcher('https://example.test');
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});

test('404 gibi 4xx retry EDİLMEZ ve parse hatası olarak sınıflanır', async () => {
  let calls = 0;
  const notFound: FetchLike = async () => {
    calls += 1;
    return new Response('not found', { status: 404 });
  };
  const fetcher = createStoreFetcher('ah', { retries: 2, minIntervalMs: 0, backoffMs: FAST_BACKOFF }, notFound);
  await assert.rejects(fetcher('https://example.test'), (error: unknown) => {
    assert.ok(error instanceof StoreApiError);
    assert.equal(error.kind, 'parse');
    return true;
  });
  assert.equal(calls, 1);
});

test('401 auth olarak sınıflanır ve retry edilmez', async () => {
  let calls = 0;
  const unauthorized: FetchLike = async () => {
    calls += 1;
    return new Response('token expired', { status: 401 });
  };
  const fetcher = createStoreFetcher('ah', { retries: 2, minIntervalMs: 0, backoffMs: FAST_BACKOFF }, unauthorized);
  await assert.rejects(fetcher('https://example.test'), (error: unknown) => {
    assert.ok(error instanceof StoreApiError);
    assert.equal(error.kind, 'auth');
    return true;
  });
  assert.equal(calls, 1);
});

test('timeout: yanıt gelmezse abort edip network hatası fırlatır', async () => {
  const hanging: FetchLike = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  const fetcher = createStoreFetcher('ah', { timeoutMs: 30, retries: 0, minIntervalMs: 0 }, hanging);
  await assert.rejects(fetcher('https://example.test'), (error: unknown) => {
    assert.ok(error instanceof StoreApiError);
    assert.equal(error.kind, 'network');
    return true;
  });
});

test('seri kuyruk: istek başlangıçları minIntervalMs aralıklı', async () => {
  const startTimes: number[] = [];
  const recording: FetchLike = async () => {
    startTimes.push(Date.now());
    return okResponse();
  };
  const fetcher = createStoreFetcher('ah', { minIntervalMs: 60 }, recording);
  await Promise.all([fetcher('https://a.test'), fetcher('https://b.test'), fetcher('https://c.test')]);
  assert.equal(startTimes.length, 3);
  assert.ok(startTimes[1] - startTimes[0] >= 50, `aralık 1→2 çok kısa: ${startTimes[1] - startTimes[0]}ms`);
  assert.ok(startTimes[2] - startTimes[1] >= 50, `aralık 2→3 çok kısa: ${startTimes[2] - startTimes[1]}ms`);
});

test('kuyruktaki bir hata sonraki istekleri engellemez', async () => {
  let calls = 0;
  const firstFails: FetchLike = async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error('boom');
    }
    return okResponse();
  };
  const fetcher = createStoreFetcher('ah', { retries: 0, minIntervalMs: 0 }, firstFails);
  const [first, second] = await Promise.allSettled([fetcher('https://a.test'), fetcher('https://b.test')]);
  assert.equal(first.status, 'rejected');
  assert.equal(second.status, 'fulfilled');
});
