# Market Fiyat Karşılaştırma — Bakım Rehberi

AH & Jumbo fiyat karşılaştırma özelliğinin işletme dokümantasyonu.
Mimari: `services/stores/` (sağlayıcılar) + `services/matching/` (katmanlı
eşleştirme) + `store/matchCacheStore|storePriceStore|marketMatchStore` +
`lib/market/` (UI hook'ları) + `components/cart/` (UI).

## Sağlayıcılar hakkında bilinmesi gerekenler

- **Resmi API yok.** AH anonim token'lı mobil API, Jumbo web GraphQL
  (`www.jumbo.com/api/graphql`, yalnızca `apollographql-client-name/-version`
  header'ları gerekir) kullanır. `mobileapi.jumbo.com` 2026-07-18'de tamamen
  yanıtsızdı — Jumbo bu yüzden web GraphQL'dedir.
- **Endpoint'ler haber vermeden kırılabilir.** Belirtiler: uygulamada tüm
  fiyatların `—` olması, `[store-health] ... DOWN` logları. İlk yapılacak:

  ```bash
  npx tsx tests/store-smoke/run-smoke.ts
  ```

  Rapor `tests/store-smoke/results/` altına yazılır; hangi sağlayıcının hangi
  hatayla düştüğünü gösterir.
- **Web'de canlı sağlayıcı ÇALIŞMAZ (CORS).** Expo web önizlemesi otomatik
  olarak mock sağlayıcıya düşer (`services/stores/index.ts`). Canlı davranış
  yalnızca native cihazda veya Node scriptlerinde doğrulanır.

## Sağlayıcı değiştirme / ekleme

1. `services/stores/types.ts` içindeki `StoreProvider` arayüzünü implemente
   et (örnek: `ah-provider.ts`). HTTP için `createStoreFetcher` kullan —
   timeout/retry/hız sınırı hazır gelir.
2. `services/stores/index.ts` registry'sine ekle.
3. Smoke scriptine sağlayıcıyı ekleyip canlı koş.

Ücretli bir servise (ör. Pepesto) geçiş = aynı arayüzü saran yeni bir
provider dosyası; motor ve UI değişmez.

Env anahtarları (`.env`):
- `EXPO_PUBLIC_STORE_PROVIDER=live|mock` — boşsa web'de mock, native'de live.
- `EXPO_PUBLIC_STORE_MOCK_FAIL=ah|jumbo|both` — SADECE mock modda çökme
  simülasyonu (banner/kısmi veri senaryolarını test etmek için).

## Sözlük genişletme (TR→NL)

`services/matching/dictionary.ts` — kayıt biçimi:

```ts
'malzeme adı (normalize: tr-TR küçük harf)': {
  nl: 'birincil arama terimi',
  altQueries: ['0 sonuçta denenecek yedekler'],   // opsiyonel
  matchHints: ['doğru üründe geçmesi beklenen NL token'], // opsiyonel
},
```

Ekledikten sonra doğruluk eval'ini koş; hedefler raporda basılır
(≥%85 doğruluk, sıcak koşuda <0.2 LLM çağrısı/malzeme):

```bash
npx tsx tests/match-eval/run-eval.ts
```

Sözlükte olmayan adlar çalışmayı durdurmaz — bir kez Haiku'yla çevrilir ve
kalıcı cache'e yazılır; sözlük sadece o ilk LLM maliyetini sıfırlar.

## Cache'ler ve sıfırlama

| Cache | Yer | Ömür | Sıfırlama |
|---|---|---|---|
| Eşleşme (Tier-0) | `matchCacheStore` (`yemek-app-match-cache`) | kalıcı | `useMatchCacheStore.getState().resetCache()` veya `MATCH_CACHE_VERSION`'ı artır |
| Fiyat | `storePriceStore` (`yemek-app-store-prices`) | 24 saat | `clearPrices()` veya TTL'i bekle |
| Ekran durumu | `marketMatchStore` | oturum | uygulamayı yeniden başlat |
| Eval cache'i | `tests/match-eval/cache.json` | kalıcı | dosyayı sil |

Kullanıcı düzeltmeleri cache'e `source: 'user'` ile yazılır ve otomatik
eşleştirme tarafından ezilmez (ürün sortimandan düşmedikçe). Cache şu an
cihaz-yerel (AsyncStorage); `MatchCache` arayüzü sayesinde ileride Supabase
destekli ortak bir cache drop-in eklenebilir.

## Deeplink

`lib/market/storeLinks.ts` — app şeması (appie/jumbo) → yüklü değilse web.
iOS şema sorgusu `LSApplicationQueriesSchemes` (app.json) ister ve **Expo
Go'da çalışmaz** (her zaman web fallback). Sepet doldurma bilinçli kapsam
dışıdır.

## LLM maliyet gözlemi

Her koşu `[match-run]` (katman dağılımı + toplam maliyet) ve `[match-llm]`
(çağrı başına token/maliyet) loglar. Maliyet modeli `services/matching/llm.ts`
`LLM_PRICING` sabitindedir (Haiku fiyatı değişirse orayı güncelle).
