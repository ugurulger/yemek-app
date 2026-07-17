// React Native ortamında @anthropic-ai/sdk kullanılamıyor (SDK, Metro'nun
// çözemediği Node yerleşik modüllerini `node:fs` gibi import ediyor). Bunun
// yerine Anthropic Messages API'sini RN'in yerleşik `fetch`'iyle doğrudan
// çağırıyoruz — hiçbir Node bağımlılığı yok.

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: unknown;
}

/** `system` metnini prompt cache'e alabilmek için blok formu (bkz. Anthropic prompt caching). */
export interface ClaudeSystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface ClaudeToolDefinition {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface ClaudeMessageRequest {
  model: string;
  max_tokens: number;
  system?: string | ClaudeSystemBlock[];
  messages: ClaudeMessage[];
  tools?: ClaudeToolDefinition[];
  /** Modeli belirli bir aracı çağırmaya zorlar — Gemini'nin `responseSchema`'sının Claude karşılığı. */
  tool_choice?: { type: 'tool'; name: string };
  /** 0-1 arası; verilmezse API varsayılanı (1.0) geçerlidir. */
  temperature?: number;
}

interface ClaudeContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Son sendClaudeMessage çağrısının usage'ı — callClaudeForToolInputWithUsage için. */
let lastUsage: ClaudeUsage = { inputTokens: 0, outputTokens: 0 };

async function sendClaudeMessage(body: ClaudeMessageRequest): Promise<ClaudeContentBlock[]> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
  }

  // GEÇİCİ ÖLÇÜM (salt-analiz görevi, bkz. SKILL.md): istek gönderiminden
  // yanıt gövdesi tam okunana kadarki süre — Claude API'nin (network + model
  // üretim süresi dahil) toplam gecikmesi.
  const tRequestStart = performance.now();
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        // Tarayıcı ortamlarında (Expo web) doğrudan erişimi açar; native'de zararsız.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new Error('Claude API bağlantısı kurulamadı', { cause });
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      // yanıt gövdesi okunamadıysa yalnızca durum kodunu bildir
    }
    throw new Error(`Claude API hatası (${response.status}): ${detail.slice(0, 200)}`);
  }

  const data: unknown = await response.json();
  console.log(`[PERF][recipe] claude-api-call: ${(performance.now() - tRequestStart).toFixed(0)}ms`);
  const content =
    typeof data === 'object' && data !== null
      ? (data as { content?: unknown }).content
      : undefined;

  if (!Array.isArray(content)) {
    throw new Error('Claude yanıtında content bulunamadı');
  }

  const usage =
    typeof data === 'object' && data !== null
      ? ((data as { usage?: { input_tokens?: number; output_tokens?: number } }).usage ?? {})
      : {};
  lastUsage = { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 };

  return content as ClaudeContentBlock[];
}

/**
 * Anthropic Messages API'sine bir istek gönderir ve yanıttaki ilk metin
 * bloğunu döndürür. Ağ hatası, HTTP hatası veya metin bloğu yoksa Error fırlatır;
 * çağıran taraf bunu kendi domain hata tipine sarabilir.
 */
export async function callClaudeForText(body: ClaudeMessageRequest): Promise<string> {
  const content = await sendClaudeMessage(body);

  const textBlock = content.find((block) => block.type === 'text');
  if (!textBlock || typeof textBlock.text !== 'string') {
    throw new Error('Claude yanıtında metin bulunamadı');
  }

  return textBlock.text;
}

/**
 * `tool_choice` ile zorunlu kılınan aracın `input`'unu döndürür — Claude,
 * tool-use şemasına (`input_schema`) uyan bir JSON objesi üretmeye zorlanır,
 * bu yüzden yanıt zaten ayrıştırılmış bir obje olarak gelir (markdown/JSON.parse
 * ayrıştırması gerekmez). `body.tool_choice.name` ile eşleşen bir `tool_use`
 * bloğu yoksa Error fırlatır.
 */
export async function callClaudeForToolInput(
  body: ClaudeMessageRequest & { tool_choice: { type: 'tool'; name: string } }
): Promise<Record<string, unknown>> {
  const content = await sendClaudeMessage(body);

  const toolBlock = content.find(
    (block) => block.type === 'tool_use' && block.name === body.tool_choice.name
  );
  if (!toolBlock || typeof toolBlock.input !== 'object' || toolBlock.input === null) {
    throw new Error('Claude yanıtında beklenen tool_use bloğu bulunamadı');
  }

  return toolBlock.input as Record<string, unknown>;
}

/**
 * `callClaudeForToolInput` ile aynı, ek olarak API'nin döndürdüğü gerçek
 * token kullanımını da verir — eşleştirme motorunun maliyet raporu
 * (`MatchRunReport`) gerçek rakamlarla çalışsın diye.
 */
export async function callClaudeForToolInputWithUsage(
  body: ClaudeMessageRequest & { tool_choice: { type: 'tool'; name: string } }
): Promise<{ input: Record<string, unknown>; usage: ClaudeUsage }> {
  const input = await callClaudeForToolInput(body);
  return { input, usage: lastUsage };
}
