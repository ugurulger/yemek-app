import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { setAppLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from '@/src/i18n';

/**
 * Basit dil seçici (EN/TR) — Blok B "ayarlarda dil seçici" gereksinimi.
 * Uygulamada ayrı bir ayarlar ekranı olmadığı için Mutfağım başlığının
 * sağında kompakt bir pill olarak yaşar. Seçim AsyncStorage'da kalıcıdır
 * (bkz. src/i18n — setAppLanguage).
 */
export function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const active: AppLanguage = i18n.language === 'tr' ? 'tr' : 'en';

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('settings.languageA11y')}
      className="flex-row items-center rounded-full bg-sand p-[3px]">
      {SUPPORTED_LANGUAGES.map((language) => {
        const isActive = language === active;
        return (
          <Pressable
            key={language}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            onPress={() => void setAppLanguage(language)}
            className={`rounded-full px-2.5 py-1 active:scale-95 ${isActive ? 'bg-white' : ''}`}>
            <Text
              className={`font-sans-semibold text-[11px] ${isActive ? 'text-forest' : 'text-muted'}`}>
              {language.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
