/**
 * TEK SEFERLİK script: Instagram içe aktarma eğitim carousel'inin (3 adım,
 * components/import/InstagramEduSheet.tsx) statik adım görsellerini üretir.
 *
 * Görseller RUNTIME'da üretilmez — bu script elle çalıştırılır, çıktılar
 * `assets/import-tutorial/step-{1,2,3}.png` olarak bundle'a girer ve
 * `components/import/tutorialImages.ts` manifesti require'larla yeniden
 * yazılır (manifest yeniden yazılana kadar carousel mevcut placeholder
 * çizimleriyle çalışmaya devam eder — graceful fallback).
 *
 * Çalıştırma (repo kökünden):
 *   npx tsx scripts/generate-import-tutorial-images.ts
 * Anahtar: .env'deki EXPO_PUBLIC_GOOGLE_API_KEY (veya GOOGLE_API_KEY env
 * değişkeni) — tarif görselleriyle (services/images/recipe-image.ts) aynı.
 *
 * Üretim deterministik DEĞİL: sonuç beğenilmezse aşağıdaki STEP_PROMPTS
 * düzenlenip script yeniden çalıştırılır; beğenilen görseller commit'lenip
 * daimi kalır. Tek bir adımı yeniden üretmek için:
 *   npx tsx scripts/generate-import-tutorial-images.ts 2   (sadece step-2)
 */
import { GoogleGenAI } from '@google/genai';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = join(ROOT, 'assets', 'import-tutorial');
const MANIFEST_PATH = join(ROOT, 'components', 'import', 'tutorialImages.ts');

/** Tarif görselleriyle aynı model ailesi (services/images/recipe-image.ts). */
const IMAGE_MODEL = process.env.EXPO_PUBLIC_GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-lite-image';

/**
 * Carousel'deki görsel alanı ~324×150 (geniş bant) — desteklenen oranlardan
 * en yakını 16:9; kart `resizeMode="cover"` ile kırpar.
 */
const ASPECT_RATIO = '16:9';

// ---------------------------------------------------------------------------
// PROMPTLAR — beğenilmezse burayı düzenleyip script'i yeniden çalıştırın.
//
// Her prompt, carousel'deki GERÇEK adım metnini anlatır (src/i18n/locales):
//   Adım 1: "Gönderide Gönder'e dokun" — beğendiğin tarif gönderisini aç
//   Adım 2: "Paylaş menüsünü aç" — sistemin paylaş sayfası açılır
//   Adım 3: "Mutfağım'ı seç" — tarif otomatik olarak aktarılır
//
// Stil kuralları (tasarım sistemi + marka/telif):
// - Sade, flat illüstrasyon; orman yeşili #1F4A3D + krem #F7F5F0 + amber
//   #E38A2A paleti.
// - Gerçek Instagram logosu/arayüz KOPYASI YOK — stilize, jenerik bir
//   sosyal medya arayüzü temsili.
// - Görselde yazı/harf YOK (metin i18n ile kartta ayrıca gösteriliyor).
// ---------------------------------------------------------------------------

/** Üç adımda da aynı olan stil kuyruğu. */
const STYLE_SUFFIX =
  'Flat minimal vector illustration for a mobile app tutorial. ' +
  'Color palette strictly: deep forest green #1F4A3D, warm cream #F7F5F0 background, ' +
  'amber orange #E38A2A accents, white. Soft rounded shapes, generous whitespace, ' +
  'clean modern composition. Stylized generic smartphone UI — NOT a copy of any real ' +
  'social media app, no real logos, no brand marks. Absolutely no text, no words, ' +
  'no letters, no numbers anywhere in the image.';

const STEP_PROMPTS: readonly string[] = [
  // Adım 1 — gönderide "Gönder" (paper plane) ikonuna dokunma.
  'A smartphone held upright showing a stylized social media feed post: a square photo ' +
    'of a delicious home-cooked dish in forest green and amber tones, with a small row ' +
    'of simple action icons below it. A hand with one finger taps the paper-plane send ' +
    'icon, which glows amber and is slightly enlarged to draw attention. ' +
    STYLE_SUFFIX,

  // Adım 2 — sistemin paylaş sayfasının (share sheet) açılması.
  'A smartphone screen with a share sheet panel sliding up from the bottom, drawn as a ' +
    'rounded cream panel over a dimmed feed. Inside the panel a horizontal row of four ' +
    'round abstract app icons; one amber icon stands out. A finger hovers over the ' +
    'panel, about to choose. An upward arrow motif above the panel suggests the sheet ' +
    'opening. ' +
    STYLE_SUFFIX,

  // Adım 3 — paylaş menüsünden "Mutfağım" uygulamasını seçme → otomatik aktarım.
  'A finger tapping a highlighted forest-green app icon with a small chef hat and ' +
    'cooking pan symbol, inside a stylized share sheet on a smartphone. From the tapped ' +
    'icon, a small recipe card with a dish illustration floats upward along a dotted ' +
    'amber path into the phone, symbolizing the recipe being imported automatically. ' +
    'Subtle sparkles around the card suggest it happens by itself. ' +
    STYLE_SUFFIX,
];

// ---------------------------------------------------------------------------
// Ortam: .env'i elle oku (dotenv bağımlılığı eklemeden — embed-recipes.ts kalıbı).
// ---------------------------------------------------------------------------

function loadDotEnv(): void {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

async function generateStepImage(ai: GoogleGenAI, step: number): Promise<void> {
  const prompt = STEP_PROMPTS[step - 1];
  console.log(`[tutorial-image] adım ${step} üretiliyor (model=${IMAGE_MODEL})…`);
  const startedAt = Date.now();

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: { imageConfig: { aspectRatio: ASPECT_RATIO } },
  });

  let base64: string | undefined;
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        base64 = part.inlineData.data;
        break;
      }
    }
  }
  if (!base64) {
    const finishReason = response.candidates?.[0]?.finishReason;
    throw new Error(
      `adım ${step}: API görsel döndürmedi (finishReason=${String(finishReason)}, ` +
        `text="${response.text?.slice(0, 200) ?? ''}")`
    );
  }

  const outPath = join(OUTPUT_DIR, `step-${step}.png`);
  writeFileSync(outPath, Buffer.from(base64, 'base64'));
  console.log(
    `[tutorial-image] adım ${step} yazıldı: ${outPath} ` +
      `(${((Date.now() - startedAt) / 1000).toFixed(1)}s, ~${Math.round((base64.length * 3) / 4 / 1024)} KB)`
  );
}

/**
 * Manifesti require'larla yeniden yazar. Manifest, görseller var OLDUĞU
 * sürece yeniden yazılır — Metro require'ı bundle ANINDA çözdüğü için
 * dosya yokken require yazılamaz (bundle kırılır); bu yüzden başlangıç
 * hâli `null` (fallback) olarak commit'lidir.
 */
function writeManifest(): void {
  const allExist = [1, 2, 3].every((step) => existsSync(join(OUTPUT_DIR, `step-${step}.png`)));
  if (!allExist) {
    console.log('[tutorial-image] 3 görsel de mevcut değil — manifest DEĞİŞTİRİLMEDİ (fallback sürer).');
    return;
  }
  const content = `// BU DOSYA scripts/generate-import-tutorial-images.ts TARAFINDAN ÜRETİLİR.
// Elle düzenlemeyin — promptu değiştirip script'i yeniden çalıştırın.
//
// Görseller henüz üretilmemişken bu sabit \`null\` olur ve InstagramEduSheet
// eski placeholder çizimlerine düşer (Metro, require'ı bundle anında
// çözdüğü için var olmayan dosyaya require yazılamaz).
import type { ImageSourcePropType } from 'react-native';

export const TUTORIAL_STEP_IMAGES:
  | readonly [ImageSourcePropType, ImageSourcePropType, ImageSourcePropType]
  | null = [
  require('../../assets/import-tutorial/step-1.png'),
  require('../../assets/import-tutorial/step-2.png'),
  require('../../assets/import-tutorial/step-3.png'),
] as const;
`;
  writeFileSync(MANIFEST_PATH, content);
  console.log(`[tutorial-image] manifest güncellendi: ${MANIFEST_PATH}`);
}

async function main(): Promise<void> {
  loadDotEnv();
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('EXPO_PUBLIC_GOOGLE_API_KEY tanımlı değil (.env dosyasını kontrol edin).');
    process.exit(1);
  }

  // Argümanla tek adım yeniden üretilebilir: `… generate-import-tutorial-images.ts 2`
  const onlyStep = process.argv[2] ? Number(process.argv[2]) : null;
  if (onlyStep !== null && ![1, 2, 3].includes(onlyStep)) {
    console.error(`Geçersiz adım: ${process.argv[2]} (1, 2 veya 3 olmalı).`);
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const ai = new GoogleGenAI({ apiKey });
  const steps = onlyStep ? [onlyStep] : [1, 2, 3];
  for (const step of steps) {
    await generateStepImage(ai, step);
  }
  writeManifest();
  console.log('[tutorial-image] bitti — görselleri beğendiyseniz assets/ + manifest commit\'lenebilir.');
}

main().catch((error) => {
  console.error('[tutorial-image] HATA:', error);
  process.exit(1);
});
