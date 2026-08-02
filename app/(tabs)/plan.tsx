import { useCallback, useMemo, useRef, useState } from 'react';
import type { View as ViewType } from 'react-native';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import PlanDayRow from '@/components/plan/PlanDayRow';
import PlanEntryCard from '@/components/plan/PlanEntryCard';
import type { PlanDragController, PlanDragSource, WindowFrame } from '@/components/plan/planDrag';
import { EmptyState } from '@/components/ui';
import { useCartStore } from '@/store/cartStore';
import { countPlannedMeals, PLAN_DAYS, usePlanStore, type PlanDay } from '@/store/planStore';

/**
 * Haptic yardımcıları — web'de expo-haptics desteklenmez (reddedilen promise);
 * sessizce yutulur ki sürükleme akışı platformdan bağımsız çalışsın.
 */
function hapticImpact(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(style).catch(() => {});
}
function hapticSelection() {
  if (Platform.OS === 'web') return;
  void Haptics.selectionAsync().catch(() => {});
}

/** measureInWindow'un Promise sarmalayıcısı (ref yoksa null döner). */
function measureView(ref: ViewType | null): Promise<WindowFrame | null> {
  return new Promise((resolve) => {
    if (!ref) {
      resolve(null);
      return;
    }
    ref.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

/**
 * Planlama — haftalık yemek ajandası (spec: Mutfagim.dc.html SCREEN 6).
 * Başlıkta bu haftaki toplam planlı öğün sayısı; altında 7 günün her biri
 * bir satır. Üç davranış katmanı (2 Ağu):
 *
 * 1) SÜRÜKLE-BIRAK: kart uzun basışla kalkar (haptic), aynı gün içinde
 *    sıralanır veya başka güne taşınır. Ölçümler sürükleme BAŞINDA
 *    measureInWindow ile alınır (sürükleme boyunca scroll kilitli olduğu
 *    için kareler bayatlamaz); overlay + gün vurgusu worklet'ten shared
 *    value'larla sürülür, store güncellemesi bırakışta JS'te yapılır.
 *    Taşıma sepete DOKUNMAZ — tarif planda kalmaya devam eder (sepet
 *    tutarlılığı yalnız kalıcı silmede değişir, bkz. handleRemoveEntry).
 * 2) DİKEY DOLULUK: hafta listesi kalan yüksekliği doldurur (flexGrow:1
 *    içerik kabı); gün satırları içerik ağırlığına (öğün sayısı) orantılı
 *    flexGrow alır — az öğünlü haftada alt boşluk kalmaz, çok öğünlü
 *    haftada liste doğal yüksekliğiyle kaydırılır.
 * 3) Kart görsel kutusu 2x (96px) — PlanEntryCard.
 */
export default function PlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const plan = usePlanStore((state) => state.plan);
  const removeFromPlan = usePlanStore((state) => state.removeFromPlan);
  const moveEntry = usePlanStore((state) => state.moveEntry);

  const totalMeals = countPlannedMeals(plan);

  // --- Sürükleme durumu -----------------------------------------------
  const [dragSource, setDragSource] = useState<PlanDragSource | null>(null);
  const dragSourceRef = useRef<PlanDragSource | null>(null);
  /** Bırakıştan hemen sonra gelen sahte onPress'i (web pointer akışı) yutar. */
  const lastDropAtRef = useRef(0);

  const containerRef = useRef<ViewType | null>(null);
  const dayRefs = useRef<(ViewType | null)[]>([]);
  const cardRefs = useRef<Record<PlanDay, (ViewType | null)[]>>({
    Pzt: [], Sal: [], Çar: [], Per: [], Cum: [], Cmt: [], Paz: [],
  });
  /** Sürükleme başında alınan JS kopyaları (bırakış hedef hesabı için). */
  const dayFramesRef = useRef<(WindowFrame | null)[]>([]);
  const cardFramesRef = useRef<Record<PlanDay, (WindowFrame | null)[]>>({
    Pzt: [], Sal: [], Çar: [], Per: [], Cum: [], Cmt: [], Paz: [],
  });
  const containerFrameRef = useRef<WindowFrame | null>(null);

  const overlayX = useSharedValue(0);
  const overlayY = useSharedValue(0);
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  const hoverDayIndex = useSharedValue(-1);
  const dayFrames = useSharedValue<WindowFrame[]>([]);

  const registerDayRef = useCallback(
    (dayIndex: number) => (ref: ViewType | null) => {
      dayRefs.current[dayIndex] = ref;
    },
    []
  );
  const registerCardRef = useCallback(
    (day: PlanDay, index: number) => (ref: ViewType | null) => {
      cardRefs.current[day][index] = ref;
    },
    []
  );

  const endDragState = useCallback(() => {
    dragSourceRef.current = null;
    setDragSource(null);
    hoverDayIndex.value = -1;
  }, [hoverDayIndex]);

  const onDragStart = useCallback(
    (day: PlanDay, index: number, _absX: number, _absY: number) => {
      const entry = usePlanStore.getState().plan[day][index];
      const cardRef = cardRefs.current[day][index];
      if (!entry || !cardRef) return;
      void (async () => {
        // Tüm kareler pencere koordinatında, TEK seferde (scroll sürükleme
        // boyunca kilitli — kareler geçerli kalır).
        const [containerFrame, cardFrame, measuredDays] = await Promise.all([
          measureView(containerRef.current),
          measureView(cardRef),
          Promise.all(PLAN_DAYS.map((_, i) => measureView(dayRefs.current[i]))),
        ]);
        const cardFrameMeasures = await Promise.all(
          PLAN_DAYS.map((d) => Promise.all(cardRefs.current[d].map((r) => measureView(r))))
        );
        if (!containerFrame || !cardFrame) return;
        containerFrameRef.current = containerFrame;
        dayFramesRef.current = measuredDays;
        PLAN_DAYS.forEach((d, i) => {
          cardFramesRef.current[d] = cardFrameMeasures[i];
        });
        dayFrames.value = measuredDays.map(
          (frame) => frame ?? { x: 0, y: -9999, width: 0, height: 0 }
        );
        // Overlay başlangıcı: kartın konteyner içi konumu; worklet buna
        // parmak translation'ını ekler.
        baseX.value = cardFrame.x - containerFrame.x;
        baseY.value = cardFrame.y - containerFrame.y;
        overlayX.value = baseX.value;
        overlayY.value = baseY.value;
        const source: PlanDragSource = { day, index, entry, frame: cardFrame };
        dragSourceRef.current = source;
        setDragSource(source);
        hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
      })();
    },
    [baseX, baseY, overlayX, overlayY, dayFrames]
  );

  const onDragEnd = useCallback(
    (_absX: number, absY: number) => {
      const source = dragSourceRef.current;
      if (!source) return;
      lastDropAtRef.current = Date.now();
      // Hedef gün: bırakış noktasını içeren gün karesi.
      const targetDayIndex = dayFramesRef.current.findIndex(
        (frame) => frame && absY >= frame.y && absY < frame.y + frame.height
      );
      if (targetDayIndex < 0) {
        endDragState();
        return;
      }
      const toDay = PLAN_DAYS[targetDayIndex];
      // Hedef sıra: merkez çizgisi bırakış noktasının ÜSTÜNDE kalan kart
      // sayısı (ghost dahil — geometri sürükleme boyunca sabit).
      const frames = cardFramesRef.current[toDay];
      let toIndex = 0;
      for (const frame of frames) {
        if (frame && frame.y + frame.height / 2 < absY) toIndex += 1;
      }
      // Aynı gün: kaldırma sonrası index kayması (aşağı taşımada -1).
      if (toDay === source.day && toIndex > source.index) toIndex -= 1;
      if (toDay !== source.day || toIndex !== source.index) {
        moveEntry(source.day, source.index, toDay, toIndex);
        hapticImpact(Haptics.ImpactFeedbackStyle.Light);
      }
      endDragState();
    },
    [moveEntry, endDragState]
  );

  const onDragCancel = useCallback(() => {
    if (dragSourceRef.current) endDragState();
  }, [endDragState]);

  const drag: PlanDragController = useMemo(
    () => ({
      overlayX,
      overlayY,
      baseX,
      baseY,
      hoverDayIndex,
      dayFrames,
      onDragStart,
      onDragEnd,
      onDragCancel,
    }),
    [overlayX, overlayY, baseX, baseY, hoverDayIndex, dayFrames, onDragStart, onDragEnd, onDragCancel]
  );

  // Gün değişiminde küçük seçim haptic'i (yalnız aktif sürüklemede).
  useAnimatedReaction(
    () => hoverDayIndex.value,
    (current, previous) => {
      if (previous !== null && current !== previous && current >= 0) {
        runOnJS(hapticSelection)();
      }
    }
  );

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: overlayX.value },
      { translateY: overlayY.value },
      { scale: 1.04 },
    ],
  }));

  /**
   * Plan → sepet otomasyonu: tarif plandan çıkarılınca, BAŞKA planlı girdisi
   * kalmadıysa yalnızca o tarifin sepet katkısı düşer (sepet kayıtları tarif
   * bazlı olduğu için diğer tariflerin ortak malzemeleri sepette kalır).
   * NOT: sürükleme taşıması buradan GEÇMEZ (moveEntry atomik) — sepet
   * yalnız gerçek silmede güncellenir.
   */
  const handleRemoveEntry = (day: PlanDay, index: number) => {
    const entry = plan[day][index];
    removeFromPlan(day, index);
    if (!entry) return;
    const stillPlanned = PLAN_DAYS.some((d) =>
      plan[d].some(
        (other, i) => other.recipeId === entry.recipeId && !(d === day && i === index)
      )
    );
    if (!stillPlanned) {
      useCartStore.getState().removeRecipe(entry.name);
    }
  };

  const handlePressEntry = (entry: { recipeId: string }) => {
    // Bırakıştan hemen sonra web'de Pressable onPress sızabiliyor — yut.
    if (Date.now() - lastDropAtRef.current < 400) return;
    router.push(`/recipe/${entry.recipeId}?src=plan`);
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      {/* Başlık bloğu — referans 468-471: eyebrow 400 13px muted
          (letterSpacing .3) + h1 500 34px Newsreader forest. Başlık scroll
          DIŞINDA: gün listesi kalan yüksekliğin tamamını kullanır. */}
      <View className="px-5 pt-2">
        <Text className="font-sans text-[13px] tracking-[0.3px] text-muted">
          {t('plan.subtitle', { count: totalMeals })}
        </Text>
        <Text className="mt-[2px] font-serif text-[34px] text-forest">{t('plan.title')}</Text>
      </View>

      {/* Hafta boş — tarif seçmeye davet (CTA Tarifler sekmesine götürür;
          plana ekleme tarif detayındaki Plan butonuyla yapılır). */}
      {totalMeals === 0 ? (
        <View className="mt-4 px-5">
          <EmptyState
            emoji="🗓️"
            title={t('plan.emptyWeekTitle')}
            body={t('plan.emptyWeekBody')}
            ctaLabel={t('plan.emptyWeekCta')}
            onPressCta={() => router.push('/recipes')}
          />
        </View>
      ) : null}

      <View ref={containerRef} collapsable={false} className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          // Sürükleme sırasında scroll kilitli — sürükleme başında alınan
          // pencere ölçümleri geçerli kalır (basit ve güvenilir yol).
          scrollEnabled={dragSource === null}
          // flexGrow:1 — içerik ekrandan kısaysa gün satırları kalan alanı
          // orantılı doldurur (dikey doluluk); uzunsa doğal scroll.
          contentContainerStyle={{ flexGrow: 1 }}>
          <View className="flex-1 gap-3 px-5 pb-4 pt-[18px]">
            {PLAN_DAYS.map((day, dayIndex) => (
              <View
                key={day}
                // Orantılı dağılım: dolu günler öğün sayısı kadar ağırlık alır
                // (kart yükseklikleri ~eşit), boş günler tek pay.
                style={{ flexGrow: Math.max(1, plan[day].length), flexBasis: 'auto' }}>
                <PlanDayRow
                  day={day}
                  dayIndex={dayIndex}
                  entries={plan[day]}
                  onPressEntry={handlePressEntry}
                  onRemoveEntry={(index) => handleRemoveEntry(day, index)}
                  drag={drag}
                  dragSource={dragSource}
                  registerDayRef={registerDayRef}
                  registerCardRef={registerCardRef}
                />
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Sürükleme overlay'i — parmağı izleyen kart kopyası (dokunulmaz).
            KURAL: Animated.View'a NativeWind className GÜVENİLMEZ (Toast
            dersinin reanimated karşılığı — canlı testte "absolute" sınıfı
            uygulanmadı, overlay akış içinde görünmezdi): konum düz style'la. */}
        {dragSource ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 0,
                top: 0,
                width: dragSource.frame.width,
                height: dragSource.frame.height,
                zIndex: 10,
              },
              overlayStyle,
            ]}>
            <PlanEntryCard entry={dragSource.entry} onPress={() => {}} onRemove={() => {}} />
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
