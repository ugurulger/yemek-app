// Vision sağlayıcı (Claude / Gemini) karşılaştırma eval script'i.
// Kullanım: npx tsx tests/vision-eval/run-eval.ts
// fixtures/ altındaki her görsel/video + eşleşen ground-truth.json'ı her iki
// sağlayıcıdan geçirir, doğruluk/yanlış pozitif/süre/gerçek maliyet raporu üretir.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { claudeVisionProvider } from '../../services/vision/claude-provider';
import { geminiVisionProvider } from '../../services/vision/gemini-provider';
import type { InventoryItem, UsageEvent, VisionProvider } from '../../services/vision/types';

// .env yükleme — proje bir bağımlılık olarak dotenv taşımıyor, bu yüzden
// minimal bir parser kullanılıyor (harici paket eklemeye gerek yok).
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(join(__dirname, '../../.env'));

const FIXTURES_DIR = join(__dirname, 'fixtures');
const RESULTS_DIR = join(__dirname, 'results');
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov'];
// lib/media/resizeImageToBase64.ts (MAX_EDGE) ve lib/media/extractVideoFrames.ts
// (DEFAULT_MAX_FRAMES) ile aynı değerler — production davranışını yansıtsın diye.
const MAX_IMAGE_EDGE = 2576;
const MAX_VIDEO_FRAMES = 12;

// Fiyatlar $/1M token, model bazında (Claude iki aşamalı akışta iki farklı
// model kullanıyor — bkz. services/vision/claude-provider.ts). Anthropic
// claude-api referansı (2026-06-24 itibarıyla önbelleklenmiş): Sonnet 5
// girdi/çıktı fiyatı $2/$10 — bu 2026-08-31'e kadar geçerli TANITIM
// fiyatı, sonrasında $3/$15'e döner (bu tarihten sonra güncelleyin). Haiku
// 4.5: $1/$5. Gemini 2.5 Flash fiyatı bu script'te DOĞRULANMADI —
// ai.google.dev/pricing üzerinden güncel değeri girip doldurun; null
// bırakılırsa o modelin/aşamanın maliyeti hesaplanmaz.
interface PricingPerMillion {
  input: number | null;
  output: number | null;
}
const PRICING_PER_MODEL: Record<string, PricingPerMillion> = {
  'claude-sonnet-5': { input: 2.0, output: 10.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'gemini-2.5-flash': { input: null, output: null },
};

const PROVIDERS: Record<'claude' | 'gemini', VisionProvider> = {
  claude: claudeVisionProvider,
  gemini: geminiVisionProvider,
};

interface GroundTruthItem {
  name: string;
  qty: number;
  unit: string;
}

interface Fixture {
  name: string;
  mediaPath: string;
  isVideo: boolean;
  groundTruth: GroundTruthItem[];
}

function discoverFixtures(): Fixture[] {
  const files = readdirSync(FIXTURES_DIR);
  const fixtures: Fixture[] = [];
  for (const file of files) {
    const rawExt = extname(file);
    const ext = rawExt.toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(ext) && !VIDEO_EXTENSIONS.includes(ext)) continue;
    const name = basename(file, rawExt);
    const gtPath = join(FIXTURES_DIR, `${name}.ground-truth.json`);
    if (!existsSync(gtPath)) {
      console.warn(`[atla] ${file}: ${name}.ground-truth.json bulunamadı`);
      continue;
    }
    const groundTruth: GroundTruthItem[] = JSON.parse(readFileSync(gtPath, 'utf-8'));
    fixtures.push({
      name,
      mediaPath: join(FIXTURES_DIR, file),
      isVideo: VIDEO_EXTENSIONS.includes(ext),
      groundTruth,
    });
  }
  return fixtures;
}

// Uygulamada video karelere expo-video-thumbnails ile ayrılıyor (RN'e özgü,
// bu masaüstü script'inde kullanılamaz). Burada aynı kural (1 sn'de 1 kare,
// en fazla MAX_VIDEO_FRAMES kare, uzun kenar MAX_IMAGE_EDGE'i aşmasın — bkz.
// lib/media/resizeImageToBase64.ts MAX_EDGE) ffmpeg ile uygulanıyor.
function extractFramesFromVideo(videoPath: string): string[] {
  const outDir = join(tmpdir(), `vision-eval-${randomUUID()}`);
  mkdirSync(outDir, { recursive: true });
  try {
    execFileSync(
      'ffmpeg',
      [
        '-i',
        videoPath,
        '-vf',
        `fps=1,scale=${MAX_IMAGE_EDGE}:${MAX_IMAGE_EDGE}:force_original_aspect_ratio=decrease`,
        '-frames:v',
        String(MAX_VIDEO_FRAMES),
        join(outDir, 'frame-%02d.jpg'),
      ],
      { stdio: 'pipe' }
    );
  } catch (cause) {
    throw new Error(
      "ffmpeg bulunamadı veya çalıştırılamadı — video fixture'ları için ffmpeg kurulu olmalı " +
        "('brew install ffmpeg').",
      { cause }
    );
  }
  const frames = readdirSync(outDir)
    .filter((f) => f.endsWith('.jpg'))
    .sort();
  return frames.map((f) => readFileSync(join(outDir, f)).toString('base64'));
}

function loadImages(fixture: Fixture): string[] {
  if (fixture.isVideo) return extractFramesFromVideo(fixture.mediaPath);
  return [readFileSync(fixture.mediaPath).toString('base64')];
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/[().,/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Tam string eşitliği yerine ortak kelime/önek bazlı gevşek eşleştirme —
// sağlayıcılar "kırmızı şarap" yerine "şarap şişesi", "mayonez" yerine
// "truffle mayonaise" gibi küçük varyasyonlarla dönebiliyor; bunlar farklı
// ürün değil, aynı ürünün farklı ifadesi olarak sayılmalı. Tamamen farklı
// dilde isimler (örn. "süt" / "milk") kasıtlı olarak EŞLEŞMEZ — bu durum
// prompt'un Türkçe/jenerik isim kuralına uyulmadığının bir göstergesidir.
function namesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const tokensA = a.split(' ').filter((t) => t.length >= 3);
  const tokensB = b.split(' ').filter((t) => t.length >= 3);
  for (const ta of tokensA) {
    for (const tb of tokensB) {
      if (ta === tb) return true;
      if (ta.length >= 4 && tb.length >= 4 && ta.slice(0, 4) === tb.slice(0, 4)) return true;
    }
  }
  return false;
}

interface Comparison {
  matchedCount: number;
  totalTruth: number;
  falsePositives: number;
  missedNames: string[];
  falsePositiveNames: string[];
}

function compareToGroundTruth(predicted: InventoryItem[], truth: GroundTruthItem[]): Comparison {
  const truthNames = [...new Set(truth.map((t) => normalizeName(t.name)))];
  const predictedNames = [...new Set(predicted.map((p) => normalizeName(p.name)))];

  const missedNames = truthNames.filter((n) => !predictedNames.some((p) => namesMatch(n, p)));
  const falsePositiveNames = predictedNames.filter((n) => !truthNames.some((t) => namesMatch(t, n)));

  return {
    matchedCount: truthNames.length - missedNames.length,
    totalTruth: truthNames.length,
    falsePositives: falsePositiveNames.length,
    missedNames,
    falsePositiveNames,
  };
}

function costForUsage(event: UsageEvent): number | null {
  const pricing = PRICING_PER_MODEL[event.model];
  if (!pricing || pricing.input == null || pricing.output == null) return null;
  return (event.inputTokens / 1e6) * pricing.input + (event.outputTokens / 1e6) * pricing.output;
}

interface ProviderResult {
  provider: 'claude' | 'gemini';
  fixture: string;
  elapsedMs: number;
  accuracy: number;
  totalTruth: number;
  matchedCount: number;
  falsePositives: number;
  missedNames: string[];
  falsePositiveNames: string[];
  usageEvents: UsageEvent[];
  totalCostUsd: number | null;
  error?: string;
}

async function runProviderOnFixture(
  providerName: 'claude' | 'gemini',
  provider: VisionProvider,
  fixture: Fixture,
  images: string[]
): Promise<ProviderResult> {
  const usageEvents: UsageEvent[] = [];
  const start = performance.now();
  try {
    const items = await provider.extractInventory(images, {
      onUsage: (event) => usageEvents.push(event),
    });
    const elapsedMs = performance.now() - start;
    const comparison = compareToGroundTruth(items, fixture.groundTruth);

    const costs = usageEvents.map(costForUsage);
    const totalCostUsd = costs.every((c): c is number => c != null)
      ? costs.reduce((a, b) => a + b, 0)
      : null;

    return {
      provider: providerName,
      fixture: fixture.name,
      elapsedMs,
      accuracy: comparison.totalTruth > 0 ? comparison.matchedCount / comparison.totalTruth : 0,
      totalTruth: comparison.totalTruth,
      matchedCount: comparison.matchedCount,
      falsePositives: comparison.falsePositives,
      missedNames: comparison.missedNames,
      falsePositiveNames: comparison.falsePositiveNames,
      usageEvents,
      totalCostUsd,
    };
  } catch (error) {
    const elapsedMs = performance.now() - start;
    return {
      provider: providerName,
      fixture: fixture.name,
      elapsedMs,
      accuracy: 0,
      totalTruth: fixture.groundTruth.length,
      matchedCount: 0,
      falsePositives: 0,
      missedNames: fixture.groundTruth.map((t) => normalizeName(t.name)),
      falsePositiveNames: [],
      usageEvents,
      totalCostUsd: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function average(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function formatCost(cost: number | null): string {
  return cost == null ? 'hesaplanmadı (fiyat girilmemiş)' : `$${cost.toFixed(5)}`;
}

function writeReport(results: ProviderResult[]): string {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(RESULTS_DIR, `${timestamp}.md`);

  const byProvider: Record<string, ProviderResult[]> = {};
  for (const r of results) {
    (byProvider[r.provider] ??= []).push(r);
  }

  let md = `# Vision Provider Karşılaştırma Raporu\n\n`;
  md += `Tarih: ${new Date().toISOString()}\n\n`;
  md += `> Token/maliyet rakamları sağlayıcının API yanıtındaki GERÇEK \`usage\` alanından\n`;
  md += `> hesaplanıyor (tahmini değil). Gemini fiyatlandırması bu script'te doğrulanmadı —\n`;
  md += `> bkz. \`PRICING_PER_MODEL\` sabiti (run-eval.ts) ve ai.google.dev/pricing; fiyat\n`;
  md += `> girilmeden o modelin maliyeti "hesaplanmadı" görünür.\n\n`;

  md += `## Özet\n\n`;
  md += `| Sağlayıcı | Ort. Doğruluk | Toplam Yanlış Pozitif | Ort. Yanıt Süresi | Toplam Gerçek Maliyet |\n`;
  md += `|---|---|---|---|---|\n`;
  for (const [provider, rs] of Object.entries(byProvider)) {
    const avgAccuracy = average(rs.map((r) => r.accuracy)) * 100;
    const totalFP = rs.reduce((sum, r) => sum + r.falsePositives, 0);
    const avgTime = average(rs.map((r) => r.elapsedMs));
    const costs = rs.map((r) => r.totalCostUsd);
    const totalCost = costs.every((c): c is number => c != null)
      ? costs.reduce((a, b) => a + (b ?? 0), 0)
      : null;
    md += `| ${provider} | %${avgAccuracy.toFixed(0)} | ${totalFP} | ${avgTime.toFixed(0)}ms | ${formatCost(totalCost)} |\n`;
  }

  md += `\n## Fixture Detayları\n\n`;
  const fixtureNames = [...new Set(results.map((r) => r.fixture))];
  for (const fixtureName of fixtureNames) {
    md += `### ${fixtureName}\n\n`;
    md += `| Sağlayıcı | Doğruluk | Yanlış Pozitif | Süre | Gerçek Maliyet | Eksik Ürünler | Yanlış Ürünler | Hata |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    for (const r of results.filter((res) => res.fixture === fixtureName)) {
      md +=
        `| ${r.provider} | %${(r.accuracy * 100).toFixed(0)} (${r.matchedCount}/${r.totalTruth}) | ` +
        `${r.falsePositives} | ${r.elapsedMs.toFixed(0)}ms | ${formatCost(r.totalCostUsd)} | ` +
        `${r.missedNames.join(', ') || '-'} | ${r.falsePositiveNames.join(', ') || '-'} | ${r.error ?? '-'} |\n`;
    }

    // Sağlayıcı çok aşamalı ise (Claude: gözlem + yapılandırma) aşama bazında
    // token/maliyet dökümü — "Aşama 2 ucuz" iddiasını gerçek rakamla göstermek için.
    const multiStageResults = results.filter(
      (res) => res.fixture === fixtureName && res.usageEvents.length > 1
    );
    for (const r of multiStageResults) {
      md += `\n**${r.provider} aşama dökümü:**\n\n`;
      md += `| Aşama | Model | Girdi Token | Çıktı Token | Maliyet |\n`;
      md += `|---|---|---|---|---|\n`;
      for (const event of r.usageEvents) {
        md +=
          `| ${event.stage} | ${event.model} | ${event.inputTokens} | ${event.outputTokens} | ` +
          `${formatCost(costForUsage(event))} |\n`;
      }
    }
    md += `\n`;
  }

  writeFileSync(reportPath, md);
  return reportPath;
}

async function main(): Promise<void> {
  const fixtures = discoverFixtures();
  if (fixtures.length === 0) {
    console.error(
      "fixtures/ klasöründe eşleşen görsel + ground-truth.json bulunamadı. fixtures/README.md dosyasına bakın."
    );
    process.exit(1);
  }

  const results: ProviderResult[] = [];

  for (const fixture of fixtures) {
    console.log(`\n[${fixture.name}] işleniyor...`);
    let images: string[];
    try {
      images = loadImages(fixture);
    } catch (error) {
      console.error(`[${fixture.name}] atlandı: ${error instanceof Error ? error.message : error}`);
      continue;
    }

    for (const providerName of Object.keys(PROVIDERS) as Array<'claude' | 'gemini'>) {
      console.log(`  ${providerName} çağrılıyor...`);
      const result = await runProviderOnFixture(providerName, PROVIDERS[providerName], fixture, images);
      results.push(result);
      if (result.error) {
        console.log(`  ${providerName}: HATA — ${result.error}`);
      } else {
        console.log(
          `  ${providerName}: doğruluk %${(result.accuracy * 100).toFixed(0)} ` +
            `(${result.matchedCount}/${result.totalTruth}), yanlış pozitif ${result.falsePositives}, ` +
            `süre ${result.elapsedMs.toFixed(0)}ms, maliyet ${formatCost(result.totalCostUsd)}`
        );
      }
    }
  }

  const reportPath = writeReport(results);
  console.log(`\nRapor yazıldı: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
