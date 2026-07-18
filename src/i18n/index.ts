/**
 * i18n çekirdeği (BLOK B / B1): expo-localization + i18next + react-i18next.
 *
 * - Dil algılama: cihaz dili (expo-localization getLocales) — desteklenen
 *   diller: en, tr; desteklenmeyen her şey İngilizce'ye düşer (fallback EN,
 *   varsayılan dil İngilizce — Blok B kararı).
 * - Kullanıcının manuel dil seçimi AsyncStorage'da saklanır ve açılışta
 *   cihaz dilinin ÖNÜNE geçer (bkz. `setAppLanguage`).
 * - Yeni UI metni kuralı: metinler ASLA hardcode edilmez — anahtar
 *   `src/i18n/locales/tr.json` + `en.json`e eklenir ve t() ile kullanılır
 *   (bkz. SKILL.md "i18n kuralı").
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import tr from './locales/tr.json';

export const LANGUAGE_STORAGE_KEY = 'yemek-app-language';

export const SUPPORTED_LANGUAGES = ['en', 'tr'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function isSupported(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'tr';
}

/** Cihaz dilini desteklenen dillere indirger — desteklenmiyorsa İngilizce. */
export function detectDeviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return isSupported(code) ? code : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr },
  },
  // Açılışta cihaz dili; AsyncStorage'daki manuel seçim aşağıda asenkron
  // yüklenir (ilk frame'de cihaz dili görünür, kayıtlı seçim varsa hemen
  // ardından uygulanır — pratikte fark edilmez).
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    // React zaten XSS'e karşı escape eder.
    escapeValue: false,
  },
  returnNull: false,
  // Eksik anahtarlar sessizce kaybolmasın: geliştirmede console.warn (bkz.
  // Blok B doğrulama adımı — "i18next missing-key uyarılarını kontrol et").
  saveMissing: __DEV__,
  missingKeyHandler: (lngs, _ns, key) => {
    console.warn(`[i18n] EKSİK ÇEVİRİ ANAHTARI: "${key}" (diller: ${lngs.join(', ')})`);
  },
});

// Kayıtlı manuel dil seçimi cihaz dilini ezer.
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((stored) => {
    if (isSupported(stored) && stored !== i18n.language) {
      void i18n.changeLanguage(stored);
    }
  })
  .catch(() => {
    // Depolama okunamazsa cihaz diliyle devam — kritik değil.
  });

/** Dil seçici (EN/TR) buradan geçer: dili değiştirir ve seçimi kalıcılaştırır. */
export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Kalıcılaştırma başarısızsa dil bu oturum için yine de değişmiştir.
  }
}

export function getAppLanguage(): AppLanguage {
  return isSupported(i18n.language) ? i18n.language : 'en';
}

/**
 * LLM çağrılarının çıktı dili parametresi (BLOK B / B3): aktif uygulama
 * dilinin İngilizce adı — prompt şablonlarına "Respond in {language}" /
 * "Yanıt dili: {language}" olarak interpolate edilir.
 */
export function llmOutputLanguage(): 'Turkish' | 'English' {
  return getAppLanguage() === 'tr' ? 'Turkish' : 'English';
}

export default i18n;
