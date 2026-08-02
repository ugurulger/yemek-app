import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import '../global.css';
// i18n init'i (dil algılama + kayıtlı seçim) her şeyden önce yüklenir.
import '@/src/i18n';
import {
  backfillInventoryTranslations,
  backfillPantryTranslations,
} from '@/src/i18n/inventoryI18n';
import { getAppLanguage } from '@/src/i18n';
import { initLanguageSync } from '@/src/i18n/languageSync';
import { ensureRecipeTranslations } from '@/src/i18n/recipeI18n';
import { ToastHost } from '@/components/ui';
import { useCookbookStore } from '@/store/cookbookStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { usePantryStore } from '@/store/pantryStore';
import {
  bindCrashIdentity,
  initCrashReporting,
  initTracking,
  posthog,
  wrapRoot,
} from '@/tracking';

// Dil değişiminde envanter/tarif çevirilerini arka planda tamamlayan dinleyici
// (bkz. src/i18n/languageSync.ts) — i18n init'inden hemen sonra, bir kez.
initLanguageSync();

// Crash raporlama render'dan ÖNCE kurulur ki modül-yükleme hataları da
// yakalansın (bkz. tracking/crash.ts — DSN yoksa sessizce kapalı kalır).
initCrashReporting();

// Analitik açılış: milestone cache + app.opened (soğuk başlangıç) + AppState
// dinleyicisi; ardından Sentry ↔ PostHog kimlik köprüsü (aynı anonim UUID).
void initTracking(getAppLanguage).then(() => {
  bindCrashIdentity(posthog.getDistinctId());
});

// Tasarım piksel-sabit bir referanstan (design/reference/Mutfagim.dc.html)
// birebir taşındı — cihazın sistem yazı ölçeği (iOS Dynamic Type / Android
// font scale) büyükse chip/pill gibi dar bileşenler kart genişliğini aşıp
// düzeni bozuyordu (kullanıcı raporu: Temel Malzemeler chip taşması).
// Ölçeklemeyi tamamen kapatmak yerine 1.1 ile SINIRLIYORUZ — erişilebilirlik
// için küçük bir büyüme payı kalır, düzen kırılmaz.
type TextWithDefaults = typeof Text & { defaultProps?: { maxFontSizeMultiplier?: number } };
(Text as TextWithDefaults).defaultProps = {
  ...(Text as TextWithDefaults).defaultProps,
  maxFontSizeMultiplier: 1.1,
};
(TextInput as TextWithDefaults).defaultProps = {
  ...(TextInput as TextWithDefaults).defaultProps,
  maxFontSizeMultiplier: 1.1,
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Newsreader_500Medium,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
  });

  // Onboarding SADECE ilk açılışta gösterilir — karar persist bayrağından
  // okunur; store hidrate olmadan karar verilirse her açılış "ilk açılış"
  // sanılır, bu yüzden hidrasyon splash arkasında beklenir.
  const [onboardingHydrated, setOnboardingHydrated] = useState(() =>
    useOnboardingStore.persist.hasHydrated()
  );
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
  useEffect(
    () => useOnboardingStore.persist.onFinishHydration(() => setOnboardingHydrated(true)),
    []
  );

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && onboardingHydrated) {
      SplashScreen.hideAsync();
    }
  }, [loaded, onboardingHydrated]);

  // Açılış backfill'i (İş 3a): nameTr/nameEn karşılığı eksik envanter
  // kayıtları arka planda TEK toplu çeviri çağrısıyla (dil başına) tamamlanır.
  // Store AsyncStorage'dan hidrate olmadan koşarsa liste boş görünür — bu
  // yüzden hidrasyon beklenir. Hata sessizce yutulur (gösterim `name`e düşer,
  // bir sonraki açılışta yeniden denenir).
  useEffect(() => {
    const run = () => {
      void backfillInventoryTranslations('tr').catch(() => {});
      void backfillInventoryTranslations('en').catch(() => {});
    };
    if (useInventoryStore.persist.hasHydrated()) {
      run();
      return undefined;
    }
    return useInventoryStore.persist.onFinishHydration(run);
  }, []);

  // Aynı backfill kalıbı KULLANICI kiler malzemeleri için (Ekmek/Peynir gibi
  // asistanla eklenenler; varsayılan 20'nin çevirisi i18n anahtarından gelir,
  // onlar atlanır — bkz. backfillPantryTranslations).
  useEffect(() => {
    const run = () => {
      void backfillPantryTranslations('tr').catch(() => {});
      void backfillPantryTranslations('en').catch(() => {});
    };
    if (usePantryStore.persist.hasHydrated()) {
      run();
      return undefined;
    }
    return usePantryStore.persist.onFinishHydration(run);
  }, []);

  // Açılış tarif çeviri süpürmesi (envanter backfill kalıbının tarif karşılığı):
  // aktif dilde karşılığı olmayan üretilmiş + içe aktarılmış tarifler arka planda
  // çevrilir — daha önce başarısız/yarım kalmış çeviriler bir sonraki açılışta
  // böylece yeniden denenir. Hidrasyon bekleme ensureRecipeTranslations'ın
  // İÇİNDE (açılış languageChanged yarışının kalıcı düzeltmesi), bu yüzden
  // burada ayrıca beklemeye gerek yok; pending boşsa çağrı ucuz bir no-op.
  useEffect(() => {
    void ensureRecipeTranslations(getAppLanguage()).catch(() => {});
  }, []);

  // İlk açılış starter tarif tohumu (boş durum iyileştirmesi, 2026-07-19):
  // hidrasyon SONRASI koşar ki mevcut kullanıcının verisi taze hesap
  // sanılmasın; taze-hesap kontrolü ve tek-seferlik bayrak store'dadır.
  useEffect(() => {
    const run = () => {
      useCookbookStore.getState().seedStarterRecipes();
    };
    if (useCookbookStore.persist.hasHydrated()) {
      run();
      return undefined;
    }
    return useCookbookStore.persist.onFinishHydration(run);
  }, []);

  // App Store ekran görüntüsü demo verisi — SADECE __DEV__ +
  // EXPO_PUBLIC_DEMO_SEED=true iken; release bundle'ına girmez
  // (bkz. lib/dev/demoSeed.ts). Hidrasyon yarışına karşı kısa gecikmeli.
  useEffect(() => {
    if (!__DEV__ || process.env.EXPO_PUBLIC_DEMO_SEED !== 'true') return;
    const timer = setTimeout(() => {
      void import('@/lib/dev/demoSeed').then(({ seedDemoData }) => seedDemoData());
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (!loaded || !onboardingHydrated) {
    return null;
  }

  return (
    // Sürükle-bırak (Plan ekranı) için gesture-handler kök sarmalayıcısı —
    // uygulamada TEK kök GestureHandlerRootView olmalı, ekran içine konmaz.
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/* Geri jesti kapalı: onboarding replace ile açılır, arkasında ekran
            yoktur; animasyonsuz ki ilk kadrajda sekmeler görünmesin. */}
        <Stack.Screen name="onboarding" options={{ animation: 'none', gestureEnabled: false }} />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen
          name="capture/camera"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="capture/assistant"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      {/* İlk açılış: sekmeler yerine onboarding'e geç (replace — geri dönüşsüz).
          Bayrak set edilince Redirect kalkar, akış Tarifler'e yönlendirir. */}
      {!hasCompletedOnboarding ? <Redirect href="/onboarding" /> : null}
      {/* Global toast (referans TOAST bloğu) — tüm ekranların üstünde. */}
      <ToastHost />
    </View>
    </GestureHandlerRootView>
  );
}

// Sentry sarmalayıcı — init edilmemişse (DSN yok / web) bileşeni aynen döner.
export default wrapRoot(RootLayout);
