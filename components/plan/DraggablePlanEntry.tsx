import { useMemo } from 'react';
import type { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS } from 'react-native-reanimated';

import PlanEntryCard from '@/components/plan/PlanEntryCard';
import type { PlanDragController } from '@/components/plan/planDrag';
import type { PlanDay, PlanEntry } from '@/store/planStore';

/** Uzun basış süresi (ms) — dokunma/kaydırma ile çakışmayacak kadar uzun. */
const LONG_PRESS_MS = 280;

interface DraggablePlanEntryProps {
  day: PlanDay;
  index: number;
  entry: PlanEntry;
  drag: PlanDragController;
  /** Sürüklenen kartın kendisi — yerinde soluk "ghost" olarak kalır. */
  isDragSource: boolean;
  cardRef: (ref: View | null) => void;
  onPress: () => void;
  onRemove: () => void;
}

/**
 * Plan kartının sürüklenebilir sarmalayıcısı: uzun basış (haptic ile) sonrası
 * Pan aktifleşir; worklet overlay konumunu (base + translation) ve gezinilen
 * günü shared value'lara yazar, bırakınca hedef hesap + store güncellemesi
 * JS'e (controller.onDragEnd) devredilir. Kartın normal dokunma (detay) ve
 * X (sil) davranışları aynen durur — pan aktifleşmeden jest kartı etkilemez.
 */
export default function DraggablePlanEntry({
  day,
  index,
  entry,
  drag,
  isDragSource,
  cardRef,
  onPress,
  onRemove,
}: DraggablePlanEntryProps) {
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(LONG_PRESS_MS)
        .onStart((event) => {
          runOnJS(drag.onDragStart)(day, index, event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          drag.overlayX.value = drag.baseX.value + event.translationX;
          drag.overlayY.value = drag.baseY.value + event.translationY;
          // Gün vurgusu — pencere koordinatlı gün çerçevelerinde dikey arama.
          const frames = drag.dayFrames.value;
          let hover = -1;
          for (let i = 0; i < frames.length; i += 1) {
            const frame = frames[i];
            if (event.absoluteY >= frame.y && event.absoluteY < frame.y + frame.height) {
              hover = i;
              break;
            }
          }
          drag.hoverDayIndex.value = hover;
        })
        .onEnd((event) => {
          runOnJS(drag.onDragEnd)(event.absoluteX, event.absoluteY);
        })
        .onFinalize((_event, success) => {
          if (!success) {
            runOnJS(drag.onDragCancel)();
          }
        }),
    [day, index, drag]
  );

  return (
    <GestureDetector gesture={pan}>
      {/* collapsable=false: Android'de measureInWindow için native view şart. */}
      {/* Animated.View'a className güvenilmez (overlay dersi) — flex düz style. */}
      <Animated.View
        ref={cardRef as never}
        collapsable={false}
        style={{ flex: 1, opacity: isDragSource ? 0.35 : 1 }}>
        <PlanEntryCard entry={entry} onPress={onPress} onRemove={onRemove} />
      </Animated.View>
    </GestureDetector>
  );
}
