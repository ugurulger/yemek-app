/**
 * RAG çeşitlilik metrik analizörü (çeşitlilik ayarı işi, 2026-08-02).
 *
 * run-compare.ts'in ürettiği ham sonuç JSON'larını okur ve AYNI envanterin
 * ARDIŞIK koşuları arasındaki çeşitliliği ölçer — kullanıcı şikayeti
 * "tarif üretimi çok benzer sonuçlar veriyor" bunun düşük olması demektir.
 *
 * Kullanım:
 *   npx tsx tests/rag-tuning/diversity-metrics.ts <sonuç1.json> [<sonuç2.json> ...]
 *
 * Metrikler (envanter+yol grubu başına, koşular birleşik):
 *  - benzersiz yemek oranı: normalize edilmiş tarif adlarının benzersizlik
 *    oranı (1.0 = hiç tekrar yok)
 *  - yakın-ad çifti: ad token'ları Jaccard ≥ 0.6 olan (birebir aynı olmayan)
 *    çift sayısı — "iki scrambled-eggs varyantı" sınıfı tekrarlar
 *  - yıldız yoğunluğu: en sık yıldız malzemenin toplam tariflere oranı
 *    (yıldız = tarif adında geçen ilk envanter ürünü; yoksa ilk envanter
 *    eşleşmeli malzeme)
 *  - benzersiz teknik oranı: ad+adım metninden anahtar kelimeyle çıkarılan
 *    pişirme tekniklerinin çeşitliliği
 *  - retrieval örtüşmesi: ardışık koşuların referans başlıkları arasındaki
 *    ortalama Jaccard (1.0 = her koşu aynı referanslar → determinizm)
 *  - koşular arası tekrar: bir koşudaki tarifin önceki koşularda birebir/
 *    yakın-ad karşılığı olma oranı
 */
import { readFileSync } from 'node:fs';

interface RecipeMetric {
  name: string;
  fineDining: boolean;
  topIngredients: string[];
  liveMissing: number;
  /** run-compare 2026-08-02'den itibaren yazar; eski JSON'larda olmayabilir. */
  stepsText?: string;
}

interface RunResult {
  path: string;
  inventory: string;
  run: number;
  retrieval?: { matchedTitles?: string[]; fineDiningTitles?: string[] };
  metrics: RecipeMetric[];
  error?: string;
}

// Envanter EN adları — run-compare.ts'teki TR12/EN8 fixture'larıyla senkron
// (oradan import edilemez: modül import edilince main() koşuyor).
const INVENTORY_NAMES: Record<string, string[]> = {
  tr12: [
    'Tomato', 'Eggs', 'Feta Cheese', 'Chicken Breast', 'Potatoes', 'Yogurt',
    'Milk', 'Ground Beef', 'Zucchini', 'Carrot', 'Lemon', 'Mushrooms',
  ],
  en8: [
    'Salmon Fillet', 'Spinach', 'Heavy Cream', 'Parmesan', 'Cherry Tomatoes',
    'Eggs', 'Potatoes', 'Red Bell Pepper',
  ],
};

/** Tek kelimelik yıldız anahtarı ("Chicken Breast" → "chicken"). */
function starKey(inventoryName: string): string {
  const tokens = inventoryName.toLowerCase().split(/\s+/);
  const informative = tokens.filter(
    (t) => !['fillet', 'breast', 'ground', 'heavy', 'cherry', 'red', 'bell'].includes(t)
  );
  return (informative[0] ?? tokens[0]).replace(/s$/, '');
}

const NAME_STOP = new Set([
  'with', 'and', 'the', 'a', 'in', 'of', 'style', 'creamy', 'fresh', 'easy',
  'quick', 'simple', 'homemade', 'classic', 'hearty', 'loaded',
]);

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !NAME_STOP.has(t))
      .map((t) => t.replace(/s$/, ''))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/** Pişirme tekniği anahtar kelimeleri — ad + adım metninde aranır (EN). */
const TECHNIQUES: [string, RegExp][] = [
  ['bake/roast', /\b(bake|baked|roast|roasted|oven|gratin|casserole)\b/],
  ['pan-sear/sauté', /\b(sear|seared|saute|sauté|sautéed|skillet|pan-fr|stir-fr)\b/],
  ['fry', /\b(fry|fried|crispy)\b/],
  ['boil/simmer', /\b(boil|simmer|poach|blanch)\b/],
  ['soup/stew', /\b(soup|stew|braise|braised|chowder)\b/],
  ['grill', /\b(grill|grilled|barbecue|bbq)\b/],
  ['salad/raw', /\b(salad|slaw|raw|marinate|marinated)\b/],
  ['egg-scramble/omelet', /\b(scramble|scrambled|omelet|omelette|frittata|shakshuka|menemen)\b/],
  ['pilaf/grain', /\b(pilaf|pilav|risotto|rice bowl|bulgur)\b/],
  ['pasta', /\b(pasta|spaghetti|penne|noodle|mac and cheese)\b/],
  ['patty/meatball', /\b(patty|patties|meatball|kofte|köfte|burger|fritter)\b/],
  ['sauce/curry', /\b(curry|stroganoff|goulash|ragu)\b/],
];

function techniquesOf(metric: RecipeMetric): string[] {
  const haystack = `${metric.name} ${metric.stepsText ?? ''}`.toLowerCase();
  return TECHNIQUES.filter(([, re]) => re.test(haystack)).map(([label]) => label);
}

function starOf(metric: RecipeMetric, inventoryNames: string[]): string {
  const nTokens = nameTokens(metric.name);
  for (const inv of inventoryNames) {
    if (nTokens.has(starKey(inv))) return starKey(inv);
  }
  // Ad'da envanter ürünü yoksa: ilk envanter-eşleşmeli malzeme
  for (const ingredient of metric.topIngredients) {
    const iTokens = nameTokens(ingredient);
    for (const inv of inventoryNames) {
      if (iTokens.has(starKey(inv))) return starKey(inv);
    }
  }
  return '(other)';
}

interface GroupStats {
  runs: number;
  recipes: number;
  uniqueDishRatio: number;
  nearDupPairs: number;
  crossRunRepeatRatio: number;
  starTop: string;
  starTopShare: number;
  uniqueStarRatio: number;
  uniqueTechniqueCount: number;
  techniquePerRecipe: number;
  /** Arketip = yıldız malzeme + birincil teknik ("salmon|pan-sear"). Ad
   * kelimeleri farklı olsa da aynı arketip = kullanıcıya "aynı yemek yine"
   * hissi — FD monotonluğunu ad-Jaccard'dan çok daha iyi yakalar. */
  uniqueArchetypeRatio: number;
  crossRunArchetypeRepeatRatio: number;
  retrievalOverlap: number | null;
  fineDiningNames: string[][];
}

function analyzeGroup(results: RunResult[], inventoryNames: string[]): GroupStats {
  const all = results.flatMap((r) => r.metrics.map((m) => ({ run: r.run, m })));
  const names = all.map(({ m }) => m.name.trim().toLowerCase());
  const tokenSets = all.map(({ m }) => nameTokens(m.name));

  // Benzersiz yemek: birebir ad eşitliği VEYA yakın-ad (Jaccard ≥ 0.6) aynı
  // yemek sayılır — bileşen (union-find'sız basit kümeleme).
  const clusters: number[] = [];
  for (let i = 0; i < all.length; i++) {
    let assigned = -1;
    for (let j = 0; j < i; j++) {
      if (names[i] === names[j] || jaccard(tokenSets[i], tokenSets[j]) >= 0.6) {
        assigned = clusters[j];
        break;
      }
    }
    clusters.push(assigned === -1 ? i : assigned);
  }
  const uniqueDishes = new Set(clusters).size;

  let nearDupPairs = 0;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (names[i] !== names[j] && jaccard(tokenSets[i], tokenSets[j]) >= 0.6) nearDupPairs++;
    }
  }

  // Koşular ARASI tekrar: koşu k'daki tarifin daha önceki koşularda aynı
  // kümeye düşen karşılığı var mı?
  let crossRunRepeats = 0;
  let crossRunCandidates = 0;
  for (let i = 0; i < all.length; i++) {
    if (all[i].run === 1) continue;
    crossRunCandidates++;
    const hasEarlier = all.some(
      (other, j) => j !== i && other.run < all[i].run && clusters[j] === clusters[i]
    );
    if (hasEarlier) crossRunRepeats++;
  }

  const stars = all.map(({ m }) => starOf(m, inventoryNames));
  const starCounts = new Map<string, number>();
  for (const s of stars) starCounts.set(s, (starCounts.get(s) ?? 0) + 1);
  const [starTop, starTopCount] = [...starCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];

  const perRecipeTechniques = all.map(({ m }) => techniquesOf(m));
  const uniqueTechniques = new Set(perRecipeTechniques.flat());

  // Arketip tekrarı: yıldız + birincil (ilk eşleşen) teknik kombinasyonu.
  const archetypes = all.map((_, i) => `${stars[i]}|${perRecipeTechniques[i][0] ?? '?'}`);
  const uniqueArchetypes = new Set(archetypes).size;
  let archetypeRepeats = 0;
  let archetypeCandidates = 0;
  for (let i = 0; i < all.length; i++) {
    if (all[i].run === 1) continue;
    archetypeCandidates++;
    if (all.some((other, j) => j !== i && other.run < all[i].run && archetypes[j] === archetypes[i])) {
      archetypeRepeats++;
    }
  }

  // Retrieval örtüşmesi: ardışık koşu çiftlerinin matchedTitles Jaccard ort.
  const titleSets = results
    .filter((r) => Array.isArray(r.retrieval?.matchedTitles))
    .map((r) => new Set((r.retrieval!.matchedTitles as string[]).map((t) => t.toLowerCase())));
  let retrievalOverlap: number | null = null;
  if (titleSets.length >= 2) {
    let sum = 0;
    for (let i = 1; i < titleSets.length; i++) sum += jaccard(titleSets[i - 1], titleSets[i]);
    retrievalOverlap = sum / (titleSets.length - 1);
  }

  return {
    runs: results.length,
    recipes: all.length,
    uniqueDishRatio: all.length === 0 ? 0 : uniqueDishes / all.length,
    nearDupPairs,
    crossRunRepeatRatio: crossRunCandidates === 0 ? 0 : crossRunRepeats / crossRunCandidates,
    starTop,
    starTopShare: all.length === 0 ? 0 : starTopCount / all.length,
    uniqueStarRatio: all.length === 0 ? 0 : starCounts.size / all.length,
    uniqueTechniqueCount: uniqueTechniques.size,
    techniquePerRecipe:
      all.length === 0 ? 0 : perRecipeTechniques.filter((t) => t.length > 0).length / all.length,
    uniqueArchetypeRatio: all.length === 0 ? 0 : uniqueArchetypes / all.length,
    crossRunArchetypeRepeatRatio:
      archetypeCandidates === 0 ? 0 : archetypeRepeats / archetypeCandidates,
    retrievalOverlap,
    fineDiningNames: results.map((r) => r.metrics.filter((m) => m.fineDining).map((m) => m.name)),
  };
}

function main(): void {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Kullanım: npx tsx tests/rag-tuning/diversity-metrics.ts <sonuç.json> [...]');
    process.exit(1);
  }
  const results: RunResult[] = files.flatMap(
    (file) => JSON.parse(readFileSync(file, 'utf8')) as RunResult[]
  );

  const groups = new Map<string, RunResult[]>();
  for (const result of results) {
    if (result.error) {
      console.warn(`[atla] ${result.path}/${result.inventory}#${result.run}: ${result.error}`);
      continue;
    }
    const key = `${result.path}/${result.inventory}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }

  for (const [key, groupResults] of groups) {
    const inventoryNames = INVENTORY_NAMES[groupResults[0].inventory] ?? [];
    const stats = analyzeGroup(groupResults, inventoryNames);
    console.log(`\n=== ${key} (${stats.runs} koşu, ${stats.recipes} tarif) ===`);
    console.log(`  benzersiz yemek oranı : ${(stats.uniqueDishRatio * 100).toFixed(0)}%`);
    console.log(`  koşular arası tekrar  : ${(stats.crossRunRepeatRatio * 100).toFixed(0)}% (2.+ koşu tariflerinin öncekilerde karşılığı)`);
    console.log(`  yakın-ad çifti        : ${stats.nearDupPairs}`);
    console.log(`  yıldız yoğunluğu      : "${stats.starTop}" ${(stats.starTopShare * 100).toFixed(0)}% | benzersiz yıldız oranı ${(stats.uniqueStarRatio * 100).toFixed(0)}%`);
    console.log(`  teknik çeşitliliği    : ${stats.uniqueTechniqueCount} farklı teknik; tariflerin ${(stats.techniquePerRecipe * 100).toFixed(0)}%'inde teknik tespit edildi`);
    console.log(`  benzersiz arketip     : ${(stats.uniqueArchetypeRatio * 100).toFixed(0)}% (yıldız+teknik kombinasyonu)`);
    console.log(`  arketip tekrar oranı  : ${(stats.crossRunArchetypeRepeatRatio * 100).toFixed(0)}% (2.+ koşuların önceki koşularda aynı kombinasyonu)`);
    console.log(`  retrieval örtüşmesi   : ${stats.retrievalOverlap === null ? 'veri yok' : (stats.retrievalOverlap * 100).toFixed(0) + '%'}`);
    console.log(`  fine dining adları    :`);
    stats.fineDiningNames.forEach((names, i) => console.log(`    #${i + 1}: ${names.join(' | ') || '-'}`));
  }
}

main();
