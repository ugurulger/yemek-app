// BU DOSYA scripts/generate-import-tutorial-images.ts TARAFINDAN ÜRETİLİR.
// Elle düzenlemeyin — promptu değiştirip script'i yeniden çalıştırın.
//
// Görseller henüz üretilmemişken bu sabit `null` olur ve InstagramEduSheet
// eski placeholder çizimlerine düşer (Metro, require'ı bundle anında
// çözdüğü için var olmayan dosyaya require yazılamaz).
import type { ImageSourcePropType } from 'react-native';

export const TUTORIAL_STEP_IMAGES:
  | readonly [ImageSourcePropType, ImageSourcePropType, ImageSourcePropType]
  | null = null;
