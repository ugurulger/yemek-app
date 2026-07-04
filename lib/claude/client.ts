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

export interface ClaudeMessageRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: ClaudeMessage[];
}

/**
 * Anthropic Messages API'sine bir istek gönderir ve yanıttaki ilk metin
 * bloğunu döndürür. Ağ hatası, HTTP hatası veya metin bloğu yoksa Error fırlatır;
 * çağıran taraf bunu kendi domain hata tipine sarabilir.
 */
export async function callClaudeForText(body: ClaudeMessageRequest): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
  }

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
  const content =
    typeof data === 'object' && data !== null
      ? (data as { content?: unknown }).content
      : undefined;

  const textBlock = Array.isArray(content)
    ? (content.find(
        (block) =>
          typeof block === 'object' &&
          block !== null &&
          (block as { type?: unknown }).type === 'text'
      ) as { text?: unknown } | undefined)
    : undefined;

  if (!textBlock || typeof textBlock.text !== 'string') {
    throw new Error('Claude yanıtında metin bulunamadı');
  }

  return textBlock.text;
}
