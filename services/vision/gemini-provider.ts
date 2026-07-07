import { GoogleGenAI, Type } from '@google/genai';

import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from '@/types/inventory';

import {
  buildObservationPrompt,
  parseInventoryItems,
  parseVideoInventoryItems,
  TABULATION_TURN_PROMPT,
  VIDEO_INVENTORY_PROMPT,
} from './prompt';
import {
  InventoryVisionError,
  type ExtractInventoryOptions,
  type InventoryItem,
  type VideoFileSource,
  type VisionProvider,
} from './types';

// gemini-2.5-flash: hız/maliyet odaklı varsayılan, hem gözlem hem
// yapılandırma aşaması için kullanılır. Daha yüksek doğruluk gerekirse
// EXPO_PUBLIC_GEMINI_MODEL=gemini-2.5-pro ile değiştirilebilir.
const DEFAULT_MODEL = 'gemini-2.5-flash';

// MVP-7: video → envanter akışı (bkz. `extractInventoryFromVideoNative`) için
// varsayılan model — video anlama görevinde flash'tan daha güçlü. AYNI
// `EXPO_PUBLIC_GEMINI_MODEL` env değişkeniyle override edilir (iki aşamalı
// görüntü akışıyla PAYLAŞILIR — ayarlanırsa ikisini de etkiler).
const DEFAULT_VIDEO_TABLE_MODEL = 'gemini-2.5-pro';

// Video → envanter akışının deterministikliği için: gemini-2.5-pro'nun
// varsayılanı 1.0 ve aynı videodan farklı sonuçlar üretilmesinin kök
// nedenlerinden biriydi (temperature ayarlanmamıştı). Envanter çıkarımı
// yaratıcılık değil, tespit görevi — düşük değer tutarlılığı artırır.
const VIDEO_INVENTORY_TEMPERATURE = 0.2;

// Video → envanter akışının native structured output şeması (eski markdown
// tablo çıktısının yerine, bkz. SKILL.md — responseSchema kararı). Şema
// yapıyı API tarafında garanti eder: serbest markdown + kırılgan parser
// kombinasyonunun sessizce satır düşürme riski ortadan kalkar. Eski akıştaki
// location/detail/note alanları bilinçli olarak YOK (çıktı tokeni tasarrufu).
// İsimlendirme/confidence KURALLARI prompt'ta (bkz. `VIDEO_INVENTORY_PROMPT`).
// MVP-13 (kalibrasyon düzeltmesi): "reasoning" alanı sadece modelin kendi
// kalibrasyonu İÇİN var — UI'da GÖSTERİLMEZ, InventoryItem'a EKLENMEZ,
// parse sırasında okunup atılır. Yapılandırılmış çıktıda Gemini alanları
// `propertyOrdering`'in verdiği sırada üretir; "reasoning"i "confidence"tan
// ÖNCE koymak modeli önce net bir gerekçe yazmaya, skoru ancak ondan sonra
// vermeye zorluyor (chain-of-thought benzeri bir etki) — sıra tersine
// çevrilirse bu kalibrasyon faydası kaybolur, DEĞİŞTİRMEYİN.
const VIDEO_INVENTORY_RESPONSE_SCHEMA = {
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

// DENEYSEL — native video girişi, ESKİ iki aşamalı JSON akışı için (bkz.
// SKILL.md "Debug/deneysel notlar"). MVP-7'den itibaren video girdisi
// `extractInventoryFromVideoNative`'e yönlendirildiği için `app/(tabs)/
// index.tsx` artık bu bayrağı KULLANMIYOR — sadece `extractInventory(images,
// {video})` üzerinden doğrudan çağrılırsa hâlâ çalışır (bkz. altta).
const NATIVE_VIDEO_ENABLED = process.env.EXPO_PUBLIC_GEMINI_NATIVE_VIDEO === 'true';

// Gemini dokümantasyonu (ai.google.dev/gemini-api/docs/video-understanding):
// inline (base64) video < 100MB dosya VE < 1dk için önerilir; toplam istek
// boyutu 20MB'ı aşarsa Files API'ye geçilmesi öneriliyor (Files API burada
// UYGULANMADI — bu deneysel yol için kapsam dışı). Bu sınırı aşan videolar
// için API'ye hiç istek atmadan net bir hata veriyoruz.
const MAX_INLINE_VIDEO_BYTES = 20 * 1024 * 1024;

// MVP-7: `extractInventoryFromVideoNative` için inline/Files API eşiği —
// Google'ın önerdiği ~20MB sınırından biraz daha temkinli (istek boyutuna
// prompt + metadata da eklendiği için). Bu sınırı aşan videolar hata VERMEZ,
// otomatik olarak Gemini Files API'sine yüklenir (bkz. `uploadVideoToFilesApi`).
const FILES_API_INLINE_THRESHOLD_BYTES = 18 * 1024 * 1024;
// MVP-9 (performans): 2000ms → 1000ms. Ölçümde dosya PROCESSING→ACTIVE
// geçişi için 2 poll (~4.4s bekleme) gerekti — sabit aralık ACTIVE olduktan
// sonraki bekleme süresini artırıyor (ortalama yarım aralık kadar "boşa"
// bekleme). Daha düşük aralık bu boşa beklemeyi kısaltır, işlem SÜRESİNİ
// (kaliteyi/token'ı) etkilemez — bkz. SKILL.md "Performans notları".
const FILES_API_POLL_INTERVAL_MS = 1000;
const FILES_API_POLL_TIMEOUT_MS = 60_000;

// NOT — Context caching: Gemini 2.5 modelleri "implicit caching"i (tekrar
// eden prefix'ler için otomatik, kod gerektirmeyen önbellekleme) varsayılan
// olarak açık sunuyor; bu iki aşamalı akışta her aşamanın kendi sabit
// sistem talimatı (bkz. `./prompt.ts`) tekrar gönderildiğinde otomatik
// devreye girer, ekstra kod gerekmiyor.
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (client) {
    return client;
  }
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_GOOGLE_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { fileUri: string; mimeType: string } };
type GeminiTurn = { role: 'user' | 'model'; parts: GeminiPart[] };

interface GeminiCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

// `generateContent`'in `config` alanına aynen geçirilen üretim ayarları —
// iki aşamalı akış sadece `responseMimeType` kullanır, video → envanter akışı
// buna `responseSchema` + `temperature` ekler (bkz. `extractInventoryFromVideoNative`).
type GeminiGenerationConfig = {
  responseMimeType?: string;
  responseSchema?: typeof VIDEO_INVENTORY_RESPONSE_SCHEMA;
  temperature?: number;
};

async function callGemini(
  model: string,
  // undefined: talimat zaten bir `text` parçası olarak `contents` içinde
  // gönderiliyor demektir (bkz. `extractInventoryFromVideoNative`) — ayrı bir
  // systemInstruction eklenmez, kullanıcının orijinal tek-mesajlık yapısı korunur.
  systemPrompt: string | undefined,
  contents: GeminiTurn[],
  generationConfig: GeminiGenerationConfig
): Promise<GeminiCallResult> {
  const ai = getClient();

  let responseText: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        ...generationConfig,
      },
    });
    responseText = response.text;
    inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
  } catch (cause) {
    throw new Error('Gemini API çağrısı başarısız oldu', { cause });
  }

  if (typeof responseText !== 'string' || responseText.length === 0) {
    throw new Error('Gemini yanıtında metin bulunamadı');
  }

  return { text: responseText, inputTokens, outputTokens };
}

function estimateBase64ByteSize(base64: string): number {
  // Kaba ama yeterli tahmin: base64 4 karakter ≈ 3 bayt (padding'i ihmal eder).
  // Sadece ESKİ deneysel base64 akışı (`extractInventory`'nin `video`
  // parametresi) için kullanılır — `extractInventoryFromVideoNative`
  // MVP-9'dan itibaren `Blob.size`'ı doğrudan okuyor (bkz. altta).
  return Math.ceil((base64.length * 3) / 4);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// MVP-9 (performans): video seçiminden envanterin ekrana gelmesine kadarki
// aşamaları console.log ile raporlamak için — kalıcı ama minimal
// instrumentation (bkz. SKILL.md "Performans notları"). Kalıcı bir
// telemetri sistemi DEĞİL, sadece etiketli `performance.now()` farkları.
function logStage(label: string, ms: number): void {
  console.log(`[perf] ${label}: ${ms.toFixed(0)}ms`);
}

// MVP-7: FILES_API_INLINE_THRESHOLD_BYTES'ı aşan videolar için — dosyayı
// Gemini Files API'sine yükler, işlenmesini bekler (durum PROCESSING →
// ACTIVE) ve `fileData` parçası olarak kullanılabilecek { fileUri, mimeType }
// döner. `file` parametresi RN'in native (ağ tabanlı) Blob'u olmalı —
// `expo-file-system`'in `File`'ı DOĞRUDAN verilirse gerçek cihazda çöker
// (bkz. `extractInventoryFromVideoNative` içindeki MVP-9 notu — RN Blob
// polyfill'i ArrayBuffer'dan Blob oluşturmayı desteklemiyor, SDK'nın
// resumable upload'ı `file.slice()` ile parçalarken buna takılıyor).
// Çağıran taraf `fetch(\`data:...;base64,...\`).blob()` ile bu native
// blob'u üretip buraya geçirir.
async function uploadVideoToFilesApi(
  file: Blob,
  mimeType: string
): Promise<{ fileUri: string; mimeType: string }> {
  const ai = getClient();

  const tUploadStart = performance.now();
  let uploaded = await ai.files.upload({ file, config: { mimeType } });
  logStage('video Files API yüklemesi', performance.now() - tUploadStart);

  const tPollStart = performance.now();
  let pollCount = 0;
  const startedAt = Date.now();
  while (uploaded.state === 'PROCESSING') {
    if (Date.now() - startedAt > FILES_API_POLL_TIMEOUT_MS) {
      throw new Error('Gemini Files API dosya işleme zaman aşımına uğradı');
    }
    if (!uploaded.name) {
      throw new Error('Gemini Files API yüklemesi dosya adı döndürmedi');
    }
    await sleep(FILES_API_POLL_INTERVAL_MS);
    pollCount++;
    uploaded = await ai.files.get({ name: uploaded.name });
  }
  if (pollCount > 0) {
    logStage(`video işleme bekleme (${pollCount} poll)`, performance.now() - tPollStart);
  }

  if (uploaded.state === 'FAILED' || !uploaded.uri) {
    throw new Error('Gemini Files API dosya işleme başarısız oldu');
  }

  return { fileUri: uploaded.uri, mimeType: uploaded.mimeType ?? mimeType };
}

// MVP-6: Aşama 1 (gözlem) ve Aşama 2 (yapılandırma) artık İKİ AYRI/BAĞIMSIZ
// çağrı değil, `contents` dizisinde birden fazla `user`/`model` turu olan
// TEK bir konuşma (bkz. SKILL.md "Aşama 2" notu) — kullanıcının kendi AI
// Studio testindeki "önce gözlem iste, sonra aynı konuşmada tablo iste" akışını
// taklit eder. Gemini API durumsuz (stateless) olduğu için her çağrıda tüm
// geçmiş (ilk tur + modelin gözlem yanıtı) yeniden gönderilir.
async function runInventoryConversation(
  firstTurnParts: GeminiPart[],
  systemPrompt: string,
  model: string,
  onUsage?: ExtractInventoryOptions['onUsage'],
  onObservation?: ExtractInventoryOptions['onObservation']
): Promise<string> {
  let observation: GeminiCallResult;
  try {
    observation = await callGemini(model, systemPrompt, [{ role: 'user', parts: firstTurnParts }], {});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new InventoryVisionError(`Gemini gözlem aşaması başarısız oldu: ${message}`, { cause: error });
  }

  onUsage?.({
    stage: 'observation',
    model,
    inputTokens: observation.inputTokens,
    outputTokens: observation.outputTokens,
  });
  // DEBUG: yapılandırma turuna gitmeden önce ham gözlem metnini bildir
  // (bkz. SKILL.md "Debug: Aşama 1 ham metnini gör").
  onObservation?.(observation.text);

  let tabulation: GeminiCallResult;
  try {
    tabulation = await callGemini(
      model,
      systemPrompt,
      [
        { role: 'user', parts: firstTurnParts },
        { role: 'model', parts: [{ text: observation.text }] },
        { role: 'user', parts: [{ text: TABULATION_TURN_PROMPT }] },
      ],
      { responseMimeType: 'application/json' }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new InventoryVisionError(`Gemini yapılandırma aşaması başarısız oldu: ${message}`, { cause: error });
  }

  onUsage?.({
    stage: 'structuring',
    model,
    inputTokens: tabulation.inputTokens,
    outputTokens: tabulation.outputTokens,
  });

  return tabulation.text;
}

async function extractInventory(
  images: string[],
  options?: ExtractInventoryOptions
): Promise<InventoryItem[]> {
  const video = NATIVE_VIDEO_ENABLED ? options?.video : undefined;

  if (video == null && images.length === 0) {
    throw new InventoryVisionError('Çıkarım için en az bir görüntü gerekli');
  }

  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || DEFAULT_MODEL;

  let firstTurnParts: GeminiPart[];
  let systemPrompt: string;
  if (video != null) {
    const byteSize = estimateBase64ByteSize(video.data);
    if (byteSize > MAX_INLINE_VIDEO_BYTES) {
      throw new InventoryVisionError(
        `Video çok büyük (~${(byteSize / (1024 * 1024)).toFixed(1)}MB) — Gemini'nin inline video ` +
          `girişi için önerilen sınır ~20MB. Daha kısa/küçük bir video deneyin, ya da ` +
          `EXPO_PUBLIC_GEMINI_NATIVE_VIDEO'yu kapatıp kare-tabanlı akışı kullanın.`
      );
    }
    // buildObservationPrompt(1) kullanılır — "kareler aynı anın farklı
    // halleri, tekilleştir" kuralı tek bir video parçası için anlamsız,
    // Gemini videoyu zaten bütün olarak görür.
    firstTurnParts = [
      { inlineData: { mimeType: video.mimeType, data: video.data } },
      { text: 'Videodaki ürünleri detaylıca anlat.' },
    ];
    systemPrompt = buildObservationPrompt(1);
  } else {
    firstTurnParts = [
      ...images.map((data): GeminiPart => ({ inlineData: { mimeType: 'image/jpeg', data } })),
      { text: 'Görüntülerdeki/karelerdeki ürünleri detaylıca anlat.' },
    ];
    systemPrompt = buildObservationPrompt(images.length);
  }

  const structuredText = await runInventoryConversation(
    firstTurnParts,
    systemPrompt,
    model,
    options?.onUsage,
    options?.onObservation
  );

  return parseInventoryItems(structuredText);
}

// MVP-7: video girdisi için gözlem+yapılandırma AYRI aşamalar değil — TEK
// çağrı. Çıktı, MVP-7/8'deki serbest markdown tablo yerine artık native
// structured output (`responseSchema` + `responseMimeType: "application/json"`,
// bkz. `VIDEO_INVENTORY_RESPONSE_SCHEMA`) — markdown parser'ın satırları
// sessizce düşürmesi ve ayarlanmamış temperature (varsayılan 1.0) aynı
// videodan farklı sonuçlar üretiyordu (bkz. SKILL.md — responseSchema kararı).
// systemInstruction KULLANILMAZ — talimat tek `user` mesajının içinde.
// Yanıt `parseVideoInventoryItems` ile doğrulanır.
//
// MVP-9 (performans, bkz. SKILL.md "Performans notları"):
// - Video `VideoFileSource` (Blob + `.base64()`) olarak alınır — `.size`
//   senkron okunur, inline/Files API kararı bunun üzerinden verilir.
//   İLK versiyon Files API yoluna giden videoları `File`'ı base64'e HİÇ
//   çevirmeden doğrudan `Blob` olarak yüklüyordu ("çift base64 dönüşümü
//   kaldırıldı" iddiasıyla) — bu masaüstünde (Node) sorunsuz çalıştı ama
//   GERÇEK CİHAZDA çöktü: React Native'in `Blob` polyfill'i ArrayBuffer'dan
//   Blob oluşturmayı desteklemiyor, `expo-file-system`'in `File.slice()`'ı
//   (SDK'nın resumable upload'ı chunking için çağırıyor) buna takılıyordu.
//   DÜZELTME: Files API yoluna giden videolar için de `.base64()` çağrılıp
//   `fetch(\`data:...\`).blob()` ile RN'in native (ağ tabanlı) Blob'u elde
//   ediliyor — bu blob'un `.slice()`'ı native destekleniyor (MVP-7'nin
//   özgün, cihazda doğrulanmış çözümü). Yani bu optimizasyon PRATİKTE
//   uygulanamadı, base64 hâlâ her zaman hesaplanıyor (bkz. SKILL.md).
// - ~~Streaming (`generateContentStream`)~~ — DENENDİ, GERÇEK CİHAZDA
//   ÇÖKTÜ, GERİ ALINDI: "Response body is empty". Kök neden: SDK'nın
//   stream okuyucusu (`processStreamResponse`) `response.body.getReader()`
//   çağırıyor — bu, fetch'in gerçek bir `ReadableStream` body döndürmesini
//   gerektirir. React Native'in yerleşik `fetch` polyfill'i (Node/tarayıcı
//   fetch'inin aksine) response body'yi ReadableStream olarak SUNMUYOR
//   (`response.body` RN'de `undefined`) — bu yüzden Node'da (bu script'in
//   test edildiği ortam) sorunsuz çalıştı ama cihazda çöktü. Çözüm: normal
//   (non-streaming) `callGemini`/`generateContent`'e geri dönüldü. Gerçek
//   streaming için (`expo/fetch` gibi ReadableStream destekli bir fetch
//   polyfill'i eklemek) AYRI bir görev/bağımlılık kararı gerekir — bkz.
//   SKILL.md "Performans notları".
async function extractInventoryFromVideoNative(
  video: { file: VideoFileSource; mimeType: string },
  options?: ExtractInventoryOptions
): Promise<InventoryItem[]> {
  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || DEFAULT_VIDEO_TABLE_MODEL;
  const tTotalStart = performance.now();

  let videoPart: GeminiPart;
  try {
    const tPrepStart = performance.now();
    const base64 = await video.file.base64();
    if (video.file.size > FILES_API_INLINE_THRESHOLD_BYTES) {
      // RN'in native Blob'unu üretiyoruz — `File`'ı doğrudan vermeyin, bkz.
      // yukarıdaki MVP-9 notu (gerçek cihaz çökmesi).
      const uploadBlob = await (await fetch(`data:${video.mimeType};base64,${base64}`)).blob();
      videoPart = { fileData: await uploadVideoToFilesApi(uploadBlob, video.mimeType) };
    } else {
      videoPart = { inlineData: { mimeType: video.mimeType, data: base64 } };
    }
    logStage('video hazırlama (Files API yüklemesi dahilse dahil)', performance.now() - tPrepStart);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new InventoryVisionError(`Gemini video envanter çağrısı başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  let result: GeminiCallResult;
  const tRequestStart = performance.now();
  try {
    result = await callGemini(
      model,
      undefined,
      [{ role: 'user', parts: [videoPart, { text: VIDEO_INVENTORY_PROMPT }] }],
      {
        temperature: VIDEO_INVENTORY_TEMPERATURE,
        responseMimeType: 'application/json',
        responseSchema: VIDEO_INVENTORY_RESPONSE_SCHEMA,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new InventoryVisionError(`Gemini video envanter çağrısı başarısız oldu: ${message}`, {
      cause: error,
    });
  }
  logStage('Gemini isteği', performance.now() - tRequestStart);

  options?.onUsage?.({
    stage: 'video-inventory',
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
  options?.onObservation?.(result.text);

  const tParseStart = performance.now();
  const items = parseVideoInventoryItems(result.text);
  logStage('JSON doğrulama', performance.now() - tParseStart);
  logStage('TOPLAM (video hazırlama + Gemini isteği + parse)', performance.now() - tTotalStart);

  return items;
}

export const geminiVisionProvider: VisionProvider = {
  extractInventory,
  extractInventoryFromVideo: extractInventoryFromVideoNative,
};
