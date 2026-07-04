import { GoogleGenAI } from '@google/genai';

import { buildSystemPrompt, parseInventoryItems } from './prompt';
import { InventoryVisionError, type InventoryItem, type VisionProvider } from './types';

// gemini-2.5-flash: hız/maliyet odaklı varsayılan. Daha yüksek doğruluk
// gerekirse EXPO_PUBLIC_GEMINI_MODEL=gemini-2.5-pro ile değiştirilebilir.
const DEFAULT_MODEL = 'gemini-2.5-flash';

// NOT — Context caching: Gemini 2.5 modelleri "implicit caching"i (tekrar
// eden prefix'ler için otomatik, kod gerektirmeyen önbellekleme) varsayılan
// olarak açık sunuyor. Explicit caching (`ai.caches.create`) ise en az 2048
// giriş token'ı istiyor; buradaki sistem talimatı bunun çok altında (~birkaç
// yüz token), bu yüzden explicit caching burada UYGULANMADI — implicit
// caching zaten aynı sistem talimatı tekrar gönderildiğinde otomatik devreye
// giriyor, ekstra kod gerekmiyor.
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

async function callGemini(images: string[], systemPrompt: string): Promise<string> {
  const ai = getClient();
  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || DEFAULT_MODEL;

  const imageParts = images.map((data) => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data,
    },
  }));

  let responseText: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [...imageParts, { text: 'Görüntülerdeki ürünleri JSON olarak çıkar.' }],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });
    responseText = response.text;
  } catch (cause) {
    throw new Error('Gemini API çağrısı başarısız oldu', { cause });
  }

  if (typeof responseText !== 'string' || responseText.length === 0) {
    throw new Error('Gemini yanıtında metin bulunamadı');
  }

  return responseText;
}

async function extractInventory(images: string[]): Promise<InventoryItem[]> {
  if (images.length === 0) {
    throw new InventoryVisionError('Çıkarım için en az bir görüntü gerekli');
  }

  const systemPrompt = buildSystemPrompt(images.length);

  let responseText: string;
  try {
    responseText = await callGemini(images, systemPrompt);
  } catch (error) {
    if (error instanceof InventoryVisionError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new InventoryVisionError(`Gemini API çağrısı başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  return parseInventoryItems(responseText);
}

export const geminiVisionProvider: VisionProvider = { extractInventory };
