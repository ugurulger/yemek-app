import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { Card, SectionLabel } from '@/components/ui';
import { PRIVACY_POLICY_URL, SUPPORT_URL } from '@/lib/appLinks';
import { colors } from '@/lib/theme';
import { showToast } from '@/store/toastStore';

/**
 * Ayarlar — modal ekran (App Store hazırlığı): dil seçici + Gizlilik
 * Politikası ve Destek bağlantıları (lib/appLinks — şimdilik placeholder,
 * env ile override edilir). Bağlantılar uygulama içi tarayıcıda açılır.
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version;

  const openLink = (url: string) => {
    WebBrowser.openBrowserAsync(url).catch(() => showToast(t('settings.linkError')));
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
        <Text className="font-serif text-[24px] text-forest">{t('settings.title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.closeSheetA11y')}
          onPress={() => router.back()}
          className="h-8 w-8 items-center justify-center rounded-full bg-sand active:scale-95">
          <Ionicons name="close" size={18} color={colors.forest} />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8">
        <SectionLabel className="mb-2 mt-3">{t('settings.languageSection')}</SectionLabel>
        <Card className="flex-row items-center justify-between px-4 py-3">
          <Text className="font-sans-medium text-[14px] text-ink">{t('settings.language')}</Text>
          <LanguageSelector />
        </Card>

        <SectionLabel className="mb-2 mt-6">{t('settings.aboutSection')}</SectionLabel>
        <Card>
          <LinkRow
            icon="shield-checkmark-outline"
            label={t('settings.privacyPolicy')}
            onPress={() => openLink(PRIVACY_POLICY_URL)}
          />
          <View className="mx-4 h-px" style={{ backgroundColor: colors.divider }} />
          <LinkRow
            icon="help-buoy-outline"
            label={t('settings.support')}
            onPress={() => openLink(SUPPORT_URL)}
          />
        </Card>

        {version ? (
          <Text className="mt-6 text-center font-sans text-[12px] text-muted2">
            {t('settings.version', { version })}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70">
      <Ionicons name={icon} size={18} color={colors.forest} />
      <Text className="flex-1 font-sans-medium text-[14px] text-ink">{label}</Text>
      <Ionicons name="open-outline" size={15} color={colors.muted} />
    </Pressable>
  );
}
