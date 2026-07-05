import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Claude vision için önerilen en uzun kenar. MVP-3'te 1568 → 2576'ya
// yükseltildi: Claude Sonnet 5 (services/vision/claude-provider.ts'te
// gözlem aşaması için kullanılan model) 2576px'e kadar yüksek çözünürlüğü
// destekliyor — küçük ambalaj yazılarının okunabilmesi için gerekliydi.
// Daha büyük görüntüler hem API boyut limitlerini zorlar hem de gereksiz
// token/gecikme maliyeti getirir, bu yüzden sınırsız değil.
const MAX_EDGE = 2576;
const JPEG_COMPRESS = 0.7;

/**
 * Bir görüntüyü (local URI) Claude vision'a göndermeye uygun boyuta indirir ve
 * ham base64 (data URI prefix'i olmadan) JPEG olarak döndürür.
 *
 * En uzun kenar `MAX_EDGE` sınırından büyükse en-boy oranı korunarak küçültülür;
 * zaten küçükse yalnızca yeniden kodlanır. `width`/`height` bilinmiyorsa (0) ölçek
 * hesaplanamadığı için boyutlandırma atlanır, görüntü olduğu gibi kodlanır.
 */
export async function resizeImageToBase64(
  uri: string,
  width: number,
  height: number
): Promise<string> {
  const context = ImageManipulator.manipulate(uri);

  const longEdge = Math.max(width, height);
  if (width > 0 && height > 0 && longEdge > MAX_EDGE) {
    const scale = MAX_EDGE / longEdge;
    context.resize({
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    });
  }

  const ref = await context.renderAsync();
  const result = await ref.saveAsync({
    base64: true,
    compress: JPEG_COMPRESS,
    format: SaveFormat.JPEG,
  });

  if (!result.base64) {
    throw new Error('Görüntü işlenemedi');
  }

  return result.base64;
}
