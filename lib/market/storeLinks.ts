/**
 * "Bu mağazadan al" yönlendirmesi: mağaza uygulaması yüklüyse deeplink,
 * değilse (veya web'de) uygulama içi tarayıcıyla ürün/mağaza sayfası.
 *
 * KAPSAM SINIRI (bilinçli): karşı uygulamanın sepeti DOLDURULMAZ — resmi
 * API yok, kullanıcı hesabıyla unofficial API'ye yazmak ToS/güvenlik riski.
 * Sadece yönlendirme yapılır.
 *
 * iOS notu: `Linking.canOpenURL` yalnızca app.json'daki
 * `LSApplicationQueriesSchemes` listesindeki şemalara izin verir ("appie",
 * "jumbo" eklendi) ve bu ancak development build/production'da etkilidir —
 * Expo Go'da şema sorgusu her zaman false döner, akış web fallback'ine düşer
 * (beklenen davranış, hata değil).
 */

import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type { StoreId, StoreProduct } from '@/services/stores/types';

// DOĞRULA (gerçek cihazda, app yüklüyken): AH uygulamasının şeması "appie",
// Jumbo'nunki "jumbo" olarak bilinir; kırıksa yalnızca web fallback çalışır.
const STORE_LINKS: Record<StoreId, { appScheme: string; webHome: string }> = {
  ah: { appScheme: 'appie://', webHome: 'https://www.ah.nl' },
  jumbo: { appScheme: 'jumbo://', webHome: 'https://www.jumbo.com' },
};

export async function openStore(storeId: StoreId, product?: StoreProduct): Promise<void> {
  const { appScheme, webHome } = STORE_LINKS[storeId];

  // Native'de önce uygulama şeması denenir; web'de şema sorgusu anlamsız.
  if (Platform.OS !== 'web') {
    try {
      if (await Linking.canOpenURL(appScheme)) {
        await Linking.openURL(appScheme);
        return;
      }
    } catch {
      // şema sorgusu/açılışı başarısız — web fallback'ine düş
    }
  }

  const url = product?.webUrl ?? webHome;
  if (Platform.OS === 'web') {
    // Uygulama içi tarayıcı web'de yeni sekmeye düşer; doğrudan aç.
    await Linking.openURL(url);
    return;
  }
  await WebBrowser.openBrowserAsync(url);
}
