import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text, TextInput, View } from 'react-native';
import 'react-native-reanimated';

import '../global.css';
// i18n init'i (dil algılama + kayıtlı seçim) her şeyden önce yüklenir.
import '@/src/i18n';
import { initLanguageSync } from '@/src/i18n/languageSync';
import { ToastHost } from '@/components/ui';

// Dil değişiminde envanter/tarif çevirilerini arka planda tamamlayan dinleyici
// (bkz. src/i18n/languageSync.ts) — i18n init'inden hemen sonra, bir kez.
initLanguageSync();

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

export default function RootLayout() {
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

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen
          name="capture/camera"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="capture/assistant"
          options={{ presentation: 'modal', headerShown: false }}
        />
      </Stack>
      {/* Global toast (referans TOAST bloğu) — tüm ekranların üstünde. */}
      <ToastHost />
    </View>
  );
}
