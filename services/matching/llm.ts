/**
 * Tier 3 — LLM eşleştirici (en ucuz uygun model: claude-haiku-4-5, aynı
 * model lib/claude/parseIngredients.ts'te de kullanılıyor). İki toplu çağrı
 * tipi vardır ve her ikisi de koşu başına EN FAZLA BİR kez yapılır:
 *
 * 1. `translateQueries` — sözlükte olmayan TR malzeme adlarını NL arama
 *    sorgusuna çevirir (yalnızca sözlük ıskaladığında gerekir).
 * 2. `resolveMatches` — fuzzy'nin belirsiz bıraktığı malzemeler için
 *    mağaza başına ilk 5-8 adayı gönderip en uygun ürünü + güven skoru
 *    seçtirir (sku null = hiçbiri uygun değil).
 *
 * Sonuçlar motor tarafından Tier-0 cache'ine yazılır — aynı malzeme için
 * LLM maliyeti ömür boyu ~bir keredir. Tool zorlaması (`tool_choice`)
 * sayesinde yanıt şema garantilidir. Her çağrı `[match-llm]` ile loglanır.
 */

import { callClaudeForToolInputWithUsage, type ClaudeSystemBlock } from '@/lib/claude/client';
import type { StoreId } from '@/services/stores/types';
import type { UsageEvent } from '@/services/vision/types';

import type { LlmMatcher, LlmMatchInput, LlmMatchResult, LlmUsageTotals } from './types';

const LLM_MODEL = 'claude-haiku-4-5';

/** USD / milyon token (Haiku 4.5). Maliyet tahmini raporda kullanılır. */
export const LLM_PRICING = { inputPerMTok: 1.0, outputPerMTok: 5.0 };

export function estimateLlmCostUsd(usage: { inputTokens: number; outputTokens: number }): number {
  return (
    (usage.inputTokens / 1_000_000) * LLM_PRICING.inputPerMTok +
    (usage.outputTokens / 1_000_000) * LLM_PRICING.outputPerMTok
  );
}

// Sabit sistem blokları — cache_control ile önbelleklenir (SKILL.md kuralı:
// istekler arasında birebir aynı kalmalı ki prefix cache bozulmasın).
const TRANSLATE_SYSTEM: ClaudeSystemBlock[] = [
  {
    type: 'text',
    text:
      'Türk mutfağı malzeme adlarını Hollanda süpermarketlerinin (Albert Heijn, Jumbo) ' +
      'arama kutusunda en iyi sonuç verecek Hollandaca arama terimine çevirirsin. ' +
      'Kısa ve jenerik arama terimleri üret (ürün kategorisi adı, marka değil). ' +
      'Türk ürünleri (sucuk, ayran, bulgur gibi) Hollanda marketlerinde kendi adıyla satılıyorsa ' +
      'o adı kullan. Karşılığı olmayan malzeme için null döndür.',
    cache_control: { type: 'ephemeral' },
  },
];

const RESOLVE_SYSTEM: ClaudeSystemBlock[] = [
  {
    type: 'text',
    text:
      'Bir alışveriş asistanısın: Türkçe tarif malzemesine, Hollanda süpermarket arama ' +
      'sonuçlarından EN UYGUN ürünü seçersin. Kurallar: (1) türev ürün seçme (soğan isteniyorsa ' +
      'soğan çorbası değil, ham soğan), (2) miktar/paket boyutu tarifteki ihtiyaca makul ölçüde ' +
      'uysun, (3) emin değilsen düşük güven skoru ver, (4) hiçbir aday uygun değilse sku için ' +
      'null döndür. Her mağaza için ayrı seçim yap. Güven skoru 0-100 arası tam sayıdır.',
    cache_control: { type: 'ephemeral' },
  },
];

function logCall(stage: string, count: number, usage: { inputTokens: number; outputTokens: number }): void {
  const cost = estimateLlmCostUsd(usage);
  console.log(
    `[match-llm] ${stage}: ${count} malzeme, ${usage.inputTokens}→${usage.outputTokens} token, ~$${cost.toFixed(4)}`
  );
}

async function translateQueries(
  names: string[],
  onUsage?: (event: UsageEvent) => void
): Promise<{ queries: (string | null)[]; usage: LlmUsageTotals }> {
  if (names.length === 0) {
    return { queries: [], usage: { calls: 0, inputTokens: 0, outputTokens: 0 } };
  }
  const { input, usage } = await callClaudeForToolInputWithUsage({
    model: LLM_MODEL,
    max_tokens: 1500,
    temperature: 0,
    system: TRANSLATE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Şu Türkçe malzeme adlarını sırayla Hollandaca arama terimine çevir:\n${JSON.stringify(names)}`,
      },
    ],
    tools: [
      {
        name: 'submit_nl_queries',
        description: 'Her Türkçe malzeme için Hollandaca arama terimi (sırayla, girişle aynı uzunlukta).',
        input_schema: {
          type: 'object',
          properties: {
            queries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nl: { type: ['string', 'null'], description: 'Hollandaca arama terimi veya null' },
                },
                required: ['nl'],
              },
            },
          },
          required: ['queries'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_nl_queries' },
  });

  logCall('çeviri', names.length, usage);
  onUsage?.({ stage: 'match-translate', model: LLM_MODEL, ...usage });

  const rawQueries = Array.isArray((input as { queries?: unknown }).queries)
    ? ((input as { queries: Array<{ nl?: unknown }> }).queries)
    : [];
  const queries = names.map((_, index) => {
    const nl = rawQueries[index]?.nl;
    return typeof nl === 'string' && nl.trim() ? nl.trim() : null;
  });
  return { queries, usage: { calls: 1, ...usage } };
}

async function resolveMatches(
  inputs: LlmMatchInput[],
  onUsage?: (event: UsageEvent) => void
): Promise<{ results: LlmMatchResult[]; usage: LlmUsageTotals }> {
  if (inputs.length === 0) {
    return { results: [], usage: { calls: 0, inputTokens: 0, outputTokens: 0 } };
  }

  const payload = inputs.map((input, index) => ({
    index,
    malzeme: `${input.ingredient.qty} ${input.ingredient.unit} ${input.ingredient.name}`,
    adaylar: input.candidates.map((c) => ({
      magaza: c.storeId,
      sku: c.sku,
      ad: c.name,
      birim: c.unitSize ?? null,
      fiyat_cent: c.priceCents,
    })),
  }));

  const { input, usage } = await callClaudeForToolInputWithUsage({
    model: LLM_MODEL,
    max_tokens: 3000,
    temperature: 0,
    system: RESOLVE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Her malzeme için mağaza başına en uygun ürünü seç:\n${JSON.stringify(payload)}`,
      },
    ],
    tools: [
      {
        name: 'submit_product_matches',
        description: 'Her malzeme için mağaza başına seçilen sku + güven skoru.',
        input_schema: {
          type: 'object',
          properties: {
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'integer' },
                  picks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        magaza: { type: 'string', enum: ['ah', 'jumbo'] },
                        sku: { type: ['string', 'null'] },
                        confidence: { type: 'integer', minimum: 0, maximum: 100 },
                      },
                      required: ['magaza', 'sku', 'confidence'],
                    },
                  },
                },
                required: ['index', 'picks'],
              },
            },
          },
          required: ['matches'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_product_matches' },
  });

  logCall('seçim', inputs.length, usage);
  onUsage?.({ stage: 'match-resolve', model: LLM_MODEL, ...usage });

  const rawMatches = Array.isArray((input as { matches?: unknown }).matches)
    ? ((input as { matches: Array<{ index?: unknown; picks?: unknown }> }).matches)
    : [];

  const results: LlmMatchResult[] = inputs.map(() => ({ perStore: {} }));
  for (const raw of rawMatches) {
    const index = typeof raw.index === 'number' ? raw.index : -1;
    if (index < 0 || index >= results.length || !Array.isArray(raw.picks)) {
      continue;
    }
    for (const pick of raw.picks as Array<{ magaza?: unknown; sku?: unknown; confidence?: unknown }>) {
      const storeId = pick.magaza === 'ah' || pick.magaza === 'jumbo' ? (pick.magaza as StoreId) : null;
      if (!storeId) {
        continue;
      }
      results[index].perStore[storeId] = {
        sku: typeof pick.sku === 'string' && pick.sku ? pick.sku : null,
        confidence:
          typeof pick.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(pick.confidence))) : 50,
      };
    }
  }
  return { results, usage: { calls: 1, ...usage } };
}

export const claudeLlmMatcher: LlmMatcher = { translateQueries, resolveMatches };
