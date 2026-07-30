import { useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useOnboardingStore } from '@/store/onboardingStore';

/**
 * Onboarding — yalnız İLK açılışta gösterilen 4 ekranlık tanıtım akışı
 * (yönlendirme kararı app/_layout.tsx'te, bayrak store/onboardingStore.ts'te).
 * Akıştan HER çıkış (Atla, son ekrandaki iki buton) kullanıcıyı boş bir
 * ekrana değil, ilk haftalık planın başladığı yere — Tarifler sekmesine —
 * götürür (tarif seç → plana ekle → market listesi kendiliğinden oluşur;
 * cache boşken Tarifler zaten tercih ekranıyla yönlendirir).
 */

interface OnboardingPage {
  key: string;
  emoji: string;
  tint: string;
  titleKey: string;
  bodyKey: string;
}

const PAGES: OnboardingPage[] = [
  { key: 'welcome', emoji: '🥘', tint: colors.tintSebze, titleKey: 'onboarding.s1Title', bodyKey: 'onboarding.s1Body' },
  { key: 'recipes', emoji: '📖', tint: colors.tintSut, titleKey: 'onboarding.s2Title', bodyKey: 'onboarding.s2Body' },
  { key: 'plan', emoji: '🛒', tint: colors.tintDiger, titleKey: 'onboarding.s3Title', bodyKey: 'onboarding.s3Body' },
  { key: 'reminders', emoji: '🔔', tint: colors.amberSoft, titleKey: 'onboarding.s4Title', bodyKey: 'onboarding.s4Body' },
];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<OnboardingPage>>(null);
  const [index, setIndex] = useState(0);
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);

  const isLastPage = index === PAGES.length - 1;

  /** Akışın tek çıkışı: bayrağı kalıcı yaz + ilk haftalık plan akışına git. */
  const finish = () => {
    completeOnboarding();
    router.replace('/(tabs)/recipes');
  };

  const goToPage = (next: number) => {
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  /**
   * "Enable reminders" — yalnız bildirim İZNİ istenir (haftalık hatırlatma
   * planlaması bilinçli kapsam dışı). İzin reddedilse/hata olsa da akış
   * biter — onboarding kullanıcıyı izin diyaloğunda kilitlemez.
   */
  const handleEnableReminders = async () => {
    try {
      if (Platform.OS === 'web') {
        // expo-notifications izin akışı web'de desteklenmez; tarayıcının
        // kendi Notification API'siyle istenir (destekleyen tarayıcılarda).
        if (typeof Notification !== 'undefined') {
          await Notification.requestPermission();
        }
      } else {
        await Notifications.requestPermissionsAsync();
      }
    } catch (error) {
      console.warn('[onboarding] bildirim izni istenemedi', error);
    } finally {
      finish();
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index && next >= 0 && next < PAGES.length) setIndex(next);
  };

  return (
    <SafeAreaView className="flex-1 bg-cream">
      {/* Üst şerit — sağda Atla (son sayfada "Maybe later" aynı işi görür). */}
      <View className="h-11 flex-row items-center justify-end px-5">
        {!isLastPage ? (
          <Pressable onPress={finish} hitSlop={8} accessibilityRole="button">
            <Text className="font-sans-semibold text-[14px] text-muted">{t('onboarding.skip')}</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(page) => page.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1 items-center justify-center px-8">
            <View
              className="h-44 w-44 items-center justify-center rounded-full"
              style={{ backgroundColor: item.tint }}>
              <Text className="text-[72px] leading-[86px]">{item.emoji}</Text>
            </View>
            <Text className="mt-9 text-center font-serif text-[30px] leading-[36px] text-forest">
              {t(item.titleKey)}
            </Text>
            <Text className="mt-3 text-center font-sans text-[15.5px] leading-[23px] text-body">
              {t(item.bodyKey)}
            </Text>
          </View>
        )}
      />

      {/* Alt blok — nokta göstergesi + sayfaya göre butonlar. */}
      <View className="px-6 pb-6">
        <View className="mb-6 flex-row items-center justify-center gap-[7px]">
          {PAGES.map((page, i) => (
            <View
              key={page.key}
              className="h-2 rounded-full"
              style={{
                width: i === index ? 22 : 8,
                backgroundColor: i === index ? colors.forest : '#DDE4DE',
              }}
            />
          ))}
        </View>

        {isLastPage ? (
          <>
            <PrimaryButton label={t('onboarding.s4Enable')} onPress={handleEnableReminders} />
            <Pressable
              onPress={finish}
              accessibilityRole="button"
              className="mt-2 items-center justify-center py-3 active:opacity-60">
              <Text className="font-sans-semibold text-[14px] text-muted">
                {t('onboarding.s4Later')}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <PrimaryButton
              label={index === 0 ? t('onboarding.s1Cta') : t('common.next')}
              onPress={() => goToPage(index + 1)}
            />
            {/* Son sayfadaki ikinci butonla aynı yükseklikte boşluk — sayfalar
                arasında CTA'nın dikey konumu zıplamasın. */}
            <View className="mt-2 py-3">
              <Text className="text-[14px]"> </Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
