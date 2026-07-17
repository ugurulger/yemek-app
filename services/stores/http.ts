/**
 * Mağaza API'leri için timeout + retry + hız sınırlama sarmalayıcısı.
 * Projede genel bir fetch yardımcısı yoktu (bkz. plan); bu modül SADECE
 * `services/stores/` sağlayıcıları için yazıldı.
 *
 * - Timeout: AbortController ile (varsayılan 8 sn).
 * - Retry: yalnızca ağ hatası / 5xx / 429'da, üstel bekleme ile; diğer
 *   4xx'lerde ASLA (auth/parse hatasını tekrar denemek anlamsız).
 * - Hız sınırı: mağaza başına SERİ kuyruk + istek başlangıçları arasında
 *   asgari aralık (`services/images/recipe-image.ts` kuyruk kalıbı) —
 *   unofficial endpoint'leri boğmamak için.
 *
 * Tüm hatalar `StoreApiError`'a normalize edilir.
 */

import { StoreApiError, type StoreId } from './types';

export interface FetchPolicy {
  timeoutMs: number;
  /** İlk denemeye EK deneme sayısı. */
  retries: number;
  /** Aynı mağazaya iki istek başlangıcı arasındaki asgari süre. */
  minIntervalMs: number;
  /** Deneme i (0 tabanlı) sonrası bekleme süreleri; test için enjekte edilebilir. */
  backoffMs?: readonly number[];
}

const DEFAULT_POLICY: FetchPolicy = {
  timeoutMs: 8000,
  retries: 2,
  minIntervalMs: 300,
  backoffMs: [500, 1500],
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Mağazaya özel, kuyruklu fetch üretir. Dönen fonksiyon başarılı (2xx)
 * `Response` döndürür; diğer her durumda `StoreApiError` fırlatır.
 * `fetchImpl` sadece testlerde enjekte edilir.
 */
export function createStoreFetcher(
  storeId: StoreId,
  policy?: Partial<FetchPolicy>,
  fetchImpl: FetchLike = fetch
): FetchLike {
  const { timeoutMs, retries, minIntervalMs, backoffMs = DEFAULT_POLICY.backoffMs! } = {
    ...DEFAULT_POLICY,
    ...policy,
  };

  // Seri kuyruk: kuyruğun ucuna eklenen her istek bir öncekinin bitmesini
  // ve asgari aralığın dolmasını bekler.
  let queueTail: Promise<void> = Promise.resolve();
  let lastStartAt = 0;

  async function runOnce(input: string, init: RequestInit | undefined, attempt: number): Promise<Response> {
    const controller = new AbortController();
    const externalSignal = init?.signal;
    if (externalSignal?.aborted) {
      throw new StoreApiError(`${storeId}: istek iptal edildi`, storeId, 'network');
    }
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener?.('abort', onExternalAbort);
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response: Response;
      try {
        response = await fetchImpl(input, { ...init, signal: controller.signal });
      } catch (error) {
        throw new StoreApiError(
          `${storeId}: ağ hatası veya zaman aşımı (${timeoutMs}ms)`,
          storeId,
          'network',
          { cause: error }
        );
      }
      if (!response.ok) {
        const kind =
          response.status === 429
            ? 'rate-limit'
            : response.status === 401 || response.status === 403
              ? 'auth'
              : response.status >= 500
                ? 'network'
                : 'parse';
        const detail = await response.text().catch(() => '');
        const error = new StoreApiError(
          `${storeId}: API hatası (${response.status}): ${detail.slice(0, 160)}`,
          storeId,
          kind
        );
        if (isRetryableStatus(response.status) && attempt < retries) {
          await sleep(backoffMs[Math.min(attempt, backoffMs.length - 1)] ?? 1000);
          return runOnce(input, init, attempt + 1);
        }
        throw error;
      }
      return response;
    } catch (error) {
      if (error instanceof StoreApiError && error.kind === 'network' && attempt < retries && !externalSignal?.aborted) {
        await sleep(backoffMs[Math.min(attempt, backoffMs.length - 1)] ?? 1000);
        return runOnce(input, init, attempt + 1);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener?.('abort', onExternalAbort);
    }
  }

  return function queuedFetch(input: string, init?: RequestInit): Promise<Response> {
    const run = queueTail.then(async () => {
      const wait = lastStartAt + minIntervalMs - Date.now();
      if (wait > 0) {
        await sleep(wait);
      }
      lastStartAt = Date.now();
      return runOnce(input, init, 0);
    });
    // Kuyruk zinciri hatada kopmasın diye hatayı yutan bir kuyruk halkası tut.
    queueTail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}
