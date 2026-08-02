import type { SharedValue } from 'react-native-reanimated';

import type { PlanDay, PlanEntry } from '@/store/planStore';

/** measureInWindow sonucu — tüm sürükleme hit-test'leri PENCERE koordinatında. */
export interface WindowFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Aktif sürüklemenin React tarafındaki kimliği (overlay + ghost render'ı). */
export interface PlanDragSource {
  day: PlanDay;
  index: number;
  entry: PlanEntry;
  frame: WindowFrame;
}

/**
 * Plan ekranının sürükle-bırak denetleyicisi. Shared value'lar worklet'ten
 * (Pan onUpdate) yazılır — overlay konumu ve gün vurgusu JS köprüsüne
 * uğramadan akıcı kalır; yalnız başlangıç/bırakma JS'e düşer (ölçüm + store).
 */
export interface PlanDragController {
  /** Overlay'in ekran-konteyneri koordinatındaki sol-üst köşesi. */
  overlayX: SharedValue<number>;
  overlayY: SharedValue<number>;
  /** Sürükleme başındaki overlay konumu — worklet base + translation toplar. */
  baseX: SharedValue<number>;
  baseY: SharedValue<number>;
  /** O an üzerinde gezinilen günün index'i (PLAN_DAYS sırası; -1 = yok). */
  hoverDayIndex: SharedValue<number>;
  /** Gün satırı çerçeveleri (pencere koordinatı) — sürükleme başında ölçülür. */
  dayFrames: SharedValue<WindowFrame[]>;
  /** Uzun basış aktifleşince JS tarafında ölçüm + state kurulumu. */
  onDragStart: (day: PlanDay, index: number, absoluteX: number, absoluteY: number) => void;
  /** Parmak kalktı — hedef gün/sıra hesabı + store güncellemesi. */
  onDragEnd: (absoluteX: number, absoluteY: number) => void;
  /** Jest aktifleşmeden bitti/iptal oldu. */
  onDragCancel: () => void;
}
