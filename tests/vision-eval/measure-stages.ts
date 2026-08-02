// Buzdolabı tarama akışı AŞAMA-SÜRE ölçümü (performans işi, 2026-08-02).
// run-eval.ts doğruluk odaklıdır ve native-video yolunu HİÇ çağırmaz (bkz.
// SKILL.md "Sağlayıcı karşılaştırma notları") — bu script o boşluğu doldurur:
// üretim yollarını Node'da uçtan uca zamanlar.
//
//  A) Native video (gemini-2.5-pro, responseSchema) — üç varyant:
//     orijinal 25.7MB (Files API yolu), 10sn kırpık (~11MB, inline),
//     720p yeniden kodlanmış (inline)
//  B) İki aşamalı fotoğraf akışı (gemini-2.5-flash) — 2576px vs 1568px kare
//  C) bilingualizeItems'ın çeviri çağrısı (claude-haiku) — kritik yol maliyeti
//
// Kullanım: npx tsx tests/vision-eval/measure-stages.ts [A|B|C|hepsi]
// Gerekli: ffmpeg (brew install ffmpeg), .env'de EXPO_PUBLIC_GOOGLE_API_KEY
// (+ C için EXPO_PUBLIC_ANTHROPIC_API_KEY). Fixture: fixtures/IMG_8425.MOV.
// NOT: Node ağı ≠ cihaz ağı — mutlak süreler cihazda biraz farklıdır ama
// aşamaların ORANI ve varyantlar arası fark karşılaştırılabilir.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// .env yükleme — run-eval.ts ile aynı minimal parser.
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(join(__dirname, '../../.env'));
// Worktree'de .env bulunmayabilir (gitignore'lu) — ana repo kopyasına düş.
loadEnvFile('/Users/ugurulger/yemek-app/.env');

import { geminiVisionProvider } from '../../services/vision/gemini-provider';

// Fixture medyası gitignore'lu — worktree'de yoksa ana repo kopyasına düş.
const FIXTURE = [
  join(__dirname, 'fixtures/IMG_8425.MOV'),
  '/Users/ugurulger/yemek-app/tests/vision-eval/fixtures/IMG_8425.MOV',
].find(existsSync)!;
const VARIANT_DIR = join(tmpdir(), 'vision-measure-variants');

type StageLog = { label: string; ms: number };

// Node Blob'unu VideoFileSource şekline (senkron .size + .base64()) getirir.
function makeVideoSource(path: string) {
  const buffer = readFileSync(path);
  const blob = new Blob([buffer]);
  return Object.assign(blob, {
    base64: async () => buffer.toString('base64'),
  });
}

function ensureVariant(name: string, args: string[]): string {
  mkdirSync(VARIANT_DIR, { recursive: true });
  const out = join(VARIANT_DIR, name);
  if (!existsSync(out)) {
    execFileSync('ffmpeg', ['-y', '-i', FIXTURE, ...args, out], { stdio: 'ignore' });
  }
  return out;
}

async function timeIt<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - t };
}

async function runVideoVariant(label: string, path: string) {
  const sizeMB = statSync(path).size / (1024 * 1024);
  const stages: StageLog[] = [];
  // Sağlayıcının [perf] loglarını yakala — logStage formatı (gemini-provider.ts).
  const origLog = console.log;
  const origDebug = console.debug;
  console.log = (...args: unknown[]) => {
    const m = String(args[0] ?? '').match(/^\[perf\] (.+): (\d+)ms$/);
    if (m) stages.push({ label: m[1], ms: Number(m[2]) });
    else origLog(...args);
  };
  console.debug = () => {}; // reasoning debug gürültüsünü sustur
  try {
    const source = makeVideoSource(path);
    const usage: unknown[] = [];
    const { result: items, ms } = await timeIt(() =>
      geminiVisionProvider.extractInventoryFromVideo!(
        { file: source as never, mimeType: 'video/quicktime' },
        { language: 'tr', onUsage: (e) => usage.push(e) }
      )
    );
    origLog(`\n=== VIDEO ${label} (${sizeMB.toFixed(1)}MB) — TOPLAM ${(ms / 1000).toFixed(1)}s ===`);
    for (const s of stages) origLog(`  ${s.label}: ${(s.ms / 1000).toFixed(1)}s`);
    origLog(`  usage: ${JSON.stringify(usage)}`);
    origLog(`  ürünler (${items.length}): ${items.map((i) => `${i.name}×${i.qty}`).join(', ')}`);
  } catch (e) {
    origLog(`=== VIDEO ${label} HATA:`, e);
  } finally {
    console.log = origLog;
    console.debug = origDebug;
  }
}

async function runPhotoVariant(maxEdge: number) {
  // Videodan 5. saniyede tek kare al, uzun kenarı maxEdge'e ölçekle
  // (üretimdeki resizeImageToBase64 karşılığı ffmpeg ile; kalite ~JPEG 0.7).
  mkdirSync(VARIANT_DIR, { recursive: true });
  const framePath = join(VARIANT_DIR, `frame-${maxEdge}.jpg`);
  if (!existsSync(framePath)) {
    execFileSync(
      'ffmpeg',
      ['-y', '-ss', '5', '-i', FIXTURE, '-frames:v', '1',
       '-vf', `scale='if(gt(iw,ih),min(iw,${maxEdge}),-2)':'if(gt(iw,ih),-2,min(ih,${maxEdge}))'`,
       '-q:v', '4', framePath],
      { stdio: 'ignore' }
    );
  }
  const base64 = readFileSync(framePath).toString('base64');
  const sizeKB = statSync(framePath).size / 1024;
  // onUsage her aşama bittiğinde ateşlenir — aşama duvar sürelerini oradan türet.
  const stageTimes: Record<string, number> = {};
  let last = performance.now();
  const t0 = performance.now();
  try {
    const items = await geminiVisionProvider.extractInventory([base64], {
      onUsage: (e) => {
        stageTimes[e.stage] = performance.now() - last;
        last = performance.now();
      },
    });
    const total = performance.now() - t0;
    console.log(`\n=== FOTO ${maxEdge}px (${sizeKB.toFixed(0)}KB) — TOPLAM ${(total / 1000).toFixed(1)}s ===`);
    console.log(
      `  gözlem: ${((stageTimes['observation'] ?? 0) / 1000).toFixed(1)}s, ` +
        `yapılandırma: ${((stageTimes['structuring'] ?? 0) / 1000).toFixed(1)}s`
    );
    console.log(`  ürünler (${items.length}): ${items.map((i) => `${i.name}×${i.qty}`).join(', ')}`);
  } catch (e) {
    console.log(`=== FOTO ${maxEdge}px HATA:`, e);
  }
}

// D/E varyantları: thinkingConfig hipotezi — Gemini 2.5 modellerinde
// varsayılan "dynamic thinking" açık; tespit görevinde katkısı belirsiz,
// süreye etkisi büyük olabilir (Claude tarafında MVP-3'te aynı gerekçeyle
// thinking kapatılmıştı). Üretim koduna dokunmadan script içinde doğrudan
// @google/genai ile ölçülür; kazanç kanıtlanırsa provider'a taşınır.
async function runVideoThinkingVariant(label: string, path: string, thinkingBudget: number) {
  const { GoogleGenAI, Type } = await import('@google/genai');
  const { INVENTORY_CATEGORIES, INVENTORY_UNITS } = await import('../../types/inventory');
  const { videoInventoryPrompt, parseVideoInventoryItems } = await import('../../services/vision/prompt');
  const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GOOGLE_API_KEY! });
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        brand: { type: Type.STRING, nullable: true },
        qty: { type: Type.NUMBER },
        unit: { type: Type.STRING, enum: [...INVENTORY_UNITS] },
        category: { type: Type.STRING, enum: [...INVENTORY_CATEGORIES] },
        reasoning: { type: Type.STRING },
        confidence: { type: Type.INTEGER },
      },
      required: ['name', 'brand', 'qty', 'unit', 'category', 'reasoning', 'confidence'],
      propertyOrdering: ['name', 'brand', 'qty', 'unit', 'category', 'reasoning', 'confidence'],
    },
  };
  const base64 = readFileSync(path).toString('base64');
  const t0 = performance.now();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'video/quicktime', data: base64 } },
        { text: videoInventoryPrompt('tr') },
      ],
    }],
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: schema,
      thinkingConfig: { thinkingBudget },
    },
  });
  const ms = performance.now() - t0;
  const um = response.usageMetadata;
  const origDebug = console.debug;
  console.debug = () => {};
  const items = parseVideoInventoryItems(response.text ?? '');
  console.debug = origDebug;
  console.log(`\n=== VIDEO ${label} (thinkingBudget=${thinkingBudget}) — ${(ms / 1000).toFixed(1)}s ===`);
  console.log(
    `  girdi: ${um?.promptTokenCount}, çıktı: ${um?.candidatesTokenCount}, ` +
      `düşünme: ${um?.thoughtsTokenCount ?? 0}`
  );
  console.log(`  ürünler (${items.length}): ${items.map((i) => `${i.name}×${i.qty}`).join(', ')}`);
}

async function runPhotoThinkingVariant(maxEdge: number, opts: { imageInTurn2: boolean }) {
  const { GoogleGenAI } = await import('@google/genai');
  const { buildObservationPrompt, TABULATION_TURN_PROMPT, parseInventoryItems } = await import(
    '../../services/vision/prompt'
  );
  const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GOOGLE_API_KEY! });
  const framePath = join(VARIANT_DIR, `frame-${maxEdge}.jpg`);
  const base64 = readFileSync(framePath).toString('base64');
  const systemInstruction = buildObservationPrompt(1);
  const firstParts = [
    { inlineData: { mimeType: 'image/jpeg', data: base64 } },
    { text: 'Görüntülerdeki/karelerdeki ürünleri detaylıca anlat.' },
  ];
  const cfg = { thinkingConfig: { thinkingBudget: 0 } };

  const t0 = performance.now();
  const obs = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: firstParts }],
    config: { systemInstruction, ...cfg },
  });
  const tObs = performance.now() - t0;
  const t1 = performance.now();
  const tab = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: opts.imageInTurn2 ? firstParts : [{ text: 'Buzdolabı gözlemim aşağıda.' }],
      },
      { role: 'model', parts: [{ text: obs.text ?? '' }] },
      { role: 'user', parts: [{ text: TABULATION_TURN_PROMPT }] },
    ],
    config: { systemInstruction, responseMimeType: 'application/json', ...cfg },
  });
  const tTab = performance.now() - t1;
  const items = parseInventoryItems(tab.text ?? '');
  console.log(
    `\n=== FOTO ${maxEdge}px thinking=0, turn2 görsel=${opts.imageInTurn2 ? 'VAR' : 'YOK'} — ` +
      `TOPLAM ${((tObs + tTab) / 1000).toFixed(1)}s ===`
  );
  console.log(`  gözlem: ${(tObs / 1000).toFixed(1)}s, yapılandırma: ${(tTab / 1000).toFixed(1)}s`);
  console.log(`  ürünler (${items.length}): ${items.map((i) => `${i.name}×${i.qty}`).join(', ')}`);
}

async function runTranslate() {
  const { translateTexts } = await import('../../lib/claude/translate');
  const names = ['Süt', 'Tereyağı', 'Turşu', 'Yumurta', 'Milner Peyniri', 'Gouda Peyniri',
    'Mozzarella', 'Mayonez', 'Salata Sosu', 'Domates', 'Cherry Domates', 'Kırmızı Biber'];
  const { result, ms } = await timeIt(() => translateTexts(names, 'English'));
  console.log(`\n=== ÇEVİRİ (bilingualizeItems karşılığı, ${names.length} ad) — ${(ms / 1000).toFixed(1)}s ===`);
  console.log(`  ${result.join(', ')}`);
}

async function main() {
  const mode = process.argv[2] ?? 'hepsi';
  if (mode === 'A' || mode === 'hepsi') {
    await runVideoVariant('orijinal 1080p/23s (Files API yolu)', FIXTURE);
    await runVideoVariant('10s kırpık 1080p (inline yolu)',
      ensureVariant('trim10.mov', ['-t', '10', '-c', 'copy']));
    await runVideoVariant('720p/23s ~4Mbps (inline yolu)',
      ensureVariant('v720p.mov', ['-vf', 'scale=-2:720', '-b:v', '4M', '-c:a', 'copy']));
  }
  if (mode === 'B' || mode === 'hepsi') {
    await runPhotoVariant(2576);
    await runPhotoVariant(1568);
  }
  if (mode === 'C' || mode === 'hepsi') {
    await runTranslate();
  }
  if (mode === 'D') {
    // thinkingBudget 128 = pro'da izin verilen minimum (0 kapatma yalnız flash'ta).
    await runVideoThinkingVariant('10s kırpık 1080p', join(VARIANT_DIR, 'trim10.mov'), 128);
  }
  if (mode === 'E') {
    await runPhotoThinkingVariant(2576, { imageInTurn2: true });
    await runPhotoThinkingVariant(2576, { imageInTurn2: false });
  }
}

void main();
