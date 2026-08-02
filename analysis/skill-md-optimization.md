# SKILL.md Optimizasyon Analizi — yemek-app

Analiz tarihi: 2026-07-18 (rev. 2) · Analiz edilen dosya: `.claude/skills/yemek-app/SKILL.md`
(1515 satır, 103.552 karakter, **~54.000 token** — tokenizer oranı ölçülü: ~0.52 token/karakter).

> **Rev. 2 notu:** `claude/rag-recipe-analysis-7593f1` branch'i bu worktree'ye merge edildi
> (4 commit; SKILL.md'ye en üste 3 yeni karar bloğu ekliyor: IG-eğitim görselleri, IG-resume,
> Envanter-2Dil). Rapor bu güncel içeriğe göre yeniden hazırlandı. İlk analizdeki bulguların
> hangileri bu güncellemeyle çözüldü, §3'ün sonunda ayrıca işaretli.

## Yönetici özeti

1. **Mevcut boyut ~54K token → önerilen hedef ~15-17K token** (%68-71 azalma). Dosya her session başında okunduğu için bu, session başına ~37K token doğrudan tasarruf demek.
2. En büyük 3 kazanç alanı: **(a) "Tasarım sistemi" bölümündeki MVP-17→20 geri-alınan tasarım sagası** (~8.6K token, neredeyse tamamı salt tarih), **(b) "Envanter → tarif" bölümündeki MVP-14/15/16 evrim anlatısı + ölçüm dökümleri** (~9.2K token'ın ~6.7K'sı taşınabilir), **(c) "Sağlayıcı karşılaştırma" + "Performans notları"ndaki eski ölçüm tabloları** (~8.7K token'ın ~7.3K'sı taşınabilir).
3. Yeni merge, ilk analizin bir bulgusunu çözdü (iki dilli envanter/tarif katmanı artık belgeli, v5 sürümü dosyada) ama **koda ters düşen aktif kurallar hâlâ duruyor:** tarif sayısı (dosya: 6; kod: 6+2 fine dining=8), MVP-22'nin "parmak izi kiler içerir" iddiası (v4'te kiler çıkarıldı, dosyada hiç yazmıyor), "Supabase kurulu değil" (RAG migration'ları + edge function var), "3 sekme" (kod 5).
4. Dosya artık **üç farklı cache sürümü** söylüyor (v2 satır 991, v3 satır 228, v5 satır 82) — yalnız en üstteki doğru; ayrıca RAG Blok A, fine dining, Mutfağım tarihleri ve sheet backdrop işleri hâlâ hiç yazılmamış.
5. **Büyüme deseni sorunun kendisi:** dosya "en üste yeni blok ekle" düzeniyle tek günde +2.9K token büyüdü (97.9K → 103.6K karakter); eski bloklar hiç budanmıyor. Bakım kuralı konmazsa küçültme birkaç haftada erir.
6. Önerilen yapı: SKILL.md = yalın aktif kurallar + kısa dersler; `references/HISTORY.md` = MVP kronolojisi/ölçümler; MVP-24 ve RAG detayları için zaten var olan `services/stores/README.md` ve `README-rag.md`'ye pointer.
7. **En büyük risk:** MVP-17→20 sagası içine gömülü "kullanıcının reddettiği tasarımlar" (iki eşikli swipe, confidence rozeti, tik ikonu vb.) taşınırken kaybolursa gelecek session'lar bunları yeniden önerebilir — bunlar 6-8 satırlık bir "yapılmayacaklar" listesi olarak SKILL.md'de KALMALI.
8. İkinci risk: eski tasarım sistemi bölümü ("Bundan sapma:" başlıklı stone/emerald/Fraunces maddeleri) aktif kural gibi okunuyor; MVP-22 uyarısı artık 140+ satır yukarıda. Uygulama, onay sonrası ayrı session'da 5 adımda (en sonda plan); 1. adım (yanlış aktif kuralları düzeltme) küçültmeden bağımsız ve en yüksek öncelikli.

---

## 1. Mevcut durum ölçümü

- **Toplam:** 1515 satır · 103.552 karakter · ~54.000 token (Türkçe metin ~0.52 token/karakter oranında tokenize oluyor — İngilizce'nin ~2 katı ağır).
- Skill dizininde başka dosya yok — progressive disclosure hiç kullanılmamış; her şey tek dosyada.
- Son merge ile eklenen 3 yeni blok toplam 5.648 karakter (~2.940 token); dosya bir günde ~%6 büyüdü.

### Bölüm bazlı döküm (karakter → yaklaşık token)

| Bölüm | Satır | Karakter | ~Token | Pay |
|---|---|---:|---:|---:|
| Envanter → tarif önerisi (MVP-11/14/15/16 + canlı gösterim) | 917-1172 | 17.761 | ~9.240 | %17 |
| Tasarım sistemi (MVP-8/10/17-21 sagası dahil) | 333-562 | 16.539 | ~8.600 | %16 |
| Store modları + MVP-12/13/2-8 tarihi notları | 777-916 | 9.833 | ~5.110 | %9 |
| Performans notları (MVP-9) | 1385-1502 | 8.686 | ~4.520 | %8 |
| Sağlayıcı karşılaştırma notları (MVP-2/3/4 tabloları) | 1260-1384 | 8.023 | ~4.170 | %8 |
| Tarif görselleri + Claude structured output | 1173-1253 | 5.836 | ~3.030 | %6 |
| Video → envanter (MVP-7/12) | 699-776 | 5.481 | ~2.850 | %5 |
| MVP-22 bloğu | 196-259 | 4.559 | ~2.370 | %4 |
| İki aşamalı JSON mimarisi | 607-664 | 4.034 | ~2.100 | %4 |
| MVP-24 bloğu | 95-151 | 3.899 | ~2.030 | %4 |
| **ENVANTER-2DİL bloğu (yeni)** | 42-94 | 3.723 | ~1.940 | %3.6 |
| MVP-23 bloğu | 152-195 | 2.856 | ~1.490 | %3 |
| Envanter ekranı: eşik davranışı (MVP-8/10) | 665-698 | 2.258 | ~1.170 | %2 |
| Foto/Video → envanter (giriş) | 575-606 | 2.067 | ~1.070 | %2 |
| i18n bloğu | 260-283 | 1.463 | ~760 | %1.4 |
| Mimari | 284-305 | 1.339 | ~700 | %1.3 |
| **IG-EĞİTİM GÖRSELLERİ bloğu (yeni)** | 12-28 | 1.113 | ~580 | %1.1 |
| Sayfalar ve sorumlulukları | 316-332 | 971 | ~500 | %0.9 |
| **IG-RESUME bloğu (yeni)** | 29-41 | 812 | ~420 | %0.8 |
| Çalışma kuralları | 1503-1515 | 645 | ~335 | %0.6 |
| MVP kapsamı | 306-315 | 445 | ~230 | %0.4 |
| Veritabanı şeması | 563-572 | 437 | ~230 | %0.4 |
| Tarif chat'i | 1254-1259 | 279 | ~145 | %0.3 |

**En şişkin 10 bölüm** (ilk 10 satır): toplamda ~44K token, dosyanın ~%82'si. İlk 5 bölüm tek başına ~31.6K token (%59) ve içerikleri büyük oranda tarih/ölçüm anlatısı. Yeni üç blok toplam ~2.9K token'la 11., 17. ve 19. sıralarda — sorunun kaynağı değiller, ama büyüme deseninin örneği.

---

## 2. İçerik sınıflandırması

Sınıf tanımları: **A** = aktif kural · **B** = hata önleyici ders (kalır, kısaltılır) · **C** = salt tarih (arşive) · **D** = tekrar (tek yere indirilir).

| Bölüm / blok | Satır | Sınıf | Gerekçe ("silinirse hangi hata yapılır?" testi) |
|---|---|---|---|
| Frontmatter + giriş | 1-11 | **A** | Skill tetikleme + "kural değiştirmeden sor" kuralı. |
| **IG-EĞİTİM GÖRSELLERİ (yeni)** | 12-28 | **A/B** | Aktif iş akışı (script'le üretim, onay sonrası commit). Manifest-null/Metro-require kısıtı **B** (silinirse var olmayan dosyaya require yazılıp bundle kırılır); telif/palet kuralları **A**. ~%30 kısalabilir. |
| **IG-RESUME (yeni)** | 29-41 | **A/B** | Çıplak `instagram://` kararı **A**; "`instagram://app` feed'e navigasyon yapıp durumu sıfırlar" dersi **B** (silinirse eski şemaya dönülür). `// DOĞRULA` bekleyen doğrulama notu kalmalı. ~5 satıra iner. |
| **ENVANTER-2DİL (yeni)** | 42-94 | **A** | v5, `ingredient-match` mutabakat katmanı, "kanonik kaynak orijinal tarif" kuralı, "kısmi token örtüşmesi bilinçli eşleşmez" ilkesi — hepsi aktif ve yeni. Gözlenen-hata anlatısı kısaltılabilir (~%35). |
| MVP-24: veri katmanı, eşleştirme motoru, store'lar | 95-132 | **A/D** | Aktif mimari; detay zaten `services/stores/README.md`'de — yarıya inebilir. Jumbo `mobileapi` terki + web-CORS-mock notu **B**. |
| MVP-24: UI kararları, deeplink | 133-148 | **A** | Kullanıcı kararları + `// DOĞRULA` uyarısı. |
| MVP-24: `design/Tarif_ekle` ilgisiz notu | 149-150 | **C** | Tek seferlik bağlam. |
| MVP-23: 5 sekme, Defterler, Plan, içe aktarma | 152-192 | **A** | Güncel navigasyon + `importedRecipes` kopyalama gerekçesi (**B**) + Animated/NativeWind dersi (**B**). |
| MVP-23: doğrulama satırı | 193-194 | **C** | O günkü test sonucu. |
| MVP-22: orkestrasyon süreci (Faz 1-4) | 199-204 | **C** | Sürecin kendisi bitti. |
| MVP-22: yeni palet/tipografi, kapsam, çelişki kuralı | 205-218 | **A** | Görünümün tek kaynağı; "spec > orkestrasyon" öncelik kuralı. |
| MVP-22: şema v3 / parmak izi maddesi | 226-229 | **A ama YANLIŞ** | Kod v5; kiler v4'te parmak izinden çıktı (bkz. §3). |
| MVP-22: kiler/sepet/tercih/eksik-canlı/Şefe Sor maddeleri | 230-250 | **D** | Aynı konular aşağıda ilgili bölümlerde de anlatılıyor. |
| MVP-22: metro `import.meta` düzeltmesi | 251-253 | **B** | Silinirse `unstable_conditionNames` geri alınıp web kırılabilir. |
| i18n bloğu | 260-283 | **A** | Tamamı aktif kural; ENVANTER-2DİL bloğu bunu tamamlıyor. |
| Mimari | 284-305 | **A ama kısmen stale** | 3 sekme satırı yanlış; "Supabase kurulu değil" artık yarı-yanlış. |
| MVP kapsamı | 306-315 | **C/D** | "Kayıtlı kapsam dışı" MVP-23'le geçersiz; MVP-22/23 bloklarının tekrarı. |
| Sayfalar ve sorumlulukları | 316-332 | **A ama stale** | 4 sayfa/3 sekme anlatıyor; Plan ve Kayıtlı(Defterler) yok. Güncellenip KALMALI (iyi bir hızlı-harita). |
| Tasarım sistemi: eski renk/tipografi/bileşen dili | 335-345 | **C (riskli)** | MVP-22 ile geçersiz ama "Bundan sapma:" başlığıyla aktif gibi okunuyor. Kopya dili/boş durum kuralları (342-345) **A** olarak kurtarılmalı. |
| Ürün adı/marka ayrımı (MVP-8) | 346-350 | **A** | Hâlâ geçerli davranış kuralı. |
| Kategori grupları + Buzdolabım dış kartı (MVP-10) | 351-360 | **A** | Güncel görüntüleme mimarisi (`CATEGORY_GROUPS`, 5 grup). |
| Şerit maddesi (MVP-10, MVP-21'de kaldırıldı) | 361-370 | **C** | "Tarihi kayıt" diye kendisi de söylüyor. Confidence rozetinin ana listede olmaması **A** (1 satır). |
| İki kart render yolu (MVP-10) | 371-380 | **A/B** | Silinirse "modal ile ana liste neden farklı?" diye birleştirme denenebilir — bilinçli ayrım. |
| Emin olunamayan ürünler kartı | 381-385 | **A** | Güncel UI davranışı. |
| MVP-17 2'li grid sagası | 386-410 | **C** | MVP-19'da geri alındı, MVP-20'de tekrar geldi — nihai hâl MVP-20 maddesinde. |
| İçecek filtresi (MVP-17) | 411-423 | **A/D** | Kural aktif (`İçecek` enum'u silinmez) ama video-prompt bölümünde de anlatılıyor. |
| Yumurta/turşu kategori düzeltmesi (MVP-18) | 424-435 | **A** | Prompt'ta duran aktif yönlendirme; 3 satıra iner. |
| Swipe sagası (MVP-18) | 436-475 | **C** | Kodun tamamı MVP-20'de silindi. Stale-closure dersi genel RN bilgisi olarak HISTORY'ye. |
| MVP-19 alt alta + arka plan renkleri | 476-528 | **C + A çekirdeği** | Yerleşim kısmı geri alındı (**C**); `GROUP_BACKGROUND_COLORS` paleti ve chip stili aktif (**A**, ~5 satır). |
| MVP-20 nihai kart durumu | 529-561 | **A çekirdeği** | Nihai hâl (statik kart, qty render edilmez ama store'da kalır, 2'li grid) ~6 satıra iner; gerisi **C**. |
| Veritabanı şeması (Supabase) | 563-572 | **C (yanıltıcı)** | Hedef şema hiç kurulmadı; gerçek migration'lar (RAG korpusu) bambaşka. |
| MVP-3 düzeltme notu (eski extract dosyası) | 577-584 | **C** | `extractInventoryFromImages.ts` silinmiş (doğrulandı). |
| Foto/video akış ayrımı | 586-605 | **A** | Güncel yönlendirme (Gemini native video / Claude kare-tabanlı). |
| İki aşamalı JSON mimarisi | 607-664 | **A + C** | Akış aktif; "MVP-5'te şuydu, MVP-12'de kaldırıldı" evrim cümleleri **C**. `location` yok sayılır / `category` üretilmez kuralları **A**. |
| Eşik davranışı (CONFIDENCE_THRESHOLD=90) | 665-682 | **A** | Kodla doğrulandı. |
| MVP-10 kapsam anlatısı | 684-697 | **D** | "İki render yolu" maddesinin tekrarı. |
| Video → envanter: prompt/çağrı/doğrulayıcı | 699-775 | **A + C** | responseSchema, temperature 0.2, `propertyOrdering` (**A, kritik**), düzelt-düşürme kuralları **A**; MVP-12 kök neden hikayesi ve eski markdown akışı **C**. |
| Store modları (replaceItems vs addItems) | 777-793 | **A/B** | Silinirse miktar-katlama hatası geri gelebilir; onayın API'den önce sorulması **A**. |
| MVP-12 varyans testi | 795-811 | **C** | Ölçüm dökümü; "varyans doğal, eşik 90 süzüyor" 1 satır **B**. |
| MVP-13 kalibrasyon | 813-837 | **B + C** | `reasoning` alanı + kalibrasyon rehberi **A/B**; ürün bazlı skor dökümleri **C**. |
| MVP-2/3/4/5/6 notları | 839-890 | **B özü + C** | Tek ders: "sıkı şema gözlemi kısıtlar; şemasız gözlem + ayrı yapılandırma kazandı". 4-5 satıra iner. |
| Debug notları ([DEBUG] butonu, native-video env) | 892-902 | **A** | Buton kodda duruyor (doğrulandı). |
| MVP-8 kapsam anlatısı | 904-915 | **C/D** | Kararların hepsi yukarıda zaten var. |
| Envanter→tarif: katmanlar, kiler, şema | 917-979 | **A + YANLIŞ** | Katman kuralları/`PANTRY_STAPLES`/şema **A**; "TAM 6 tarif" eksik (6+2 fine dining, bkz. §3). |
| Tarif önbelleği | 981-995 | **A + YANLIŞ** | Cache kuralı **A**; "parmak izi kiler içerir / v2" kodla çelişiyor (v5, kiler yok). |
| MVP-14 bloğu | 997-1010 | **C** | Kendisi "fonksiyonlar artık kodda yok" diyor; çeşitlilik dersi 1 satır **B**. |
| MVP-15 mimari | 1012-1059 | **A (kısaltılır)** | İki aşamalı üretim güncel; MVP-16 düzeltmeleriyle iç içe — birleşik tek anlatım yazılmalı. |
| MVP-15 ölçüm + çeşitlilik listesi | 1060-1084 | **C** | 9 tarifin adları, süre karşılaştırmaları. |
| MVP-16 kararları | 1086-1126 | **A (kısaltılır)** | 2/2/2 dağılım, `LAYER_VARIANTS` temperature'ları, ready-retry, eksik-bazlı katman — aktif. |
| MVP-16 ölçüm | 1127-1141 | **C** | Tek koşu sonuçları. |
| Canlı gösterim (slots) | 1143-1171 | **A** | Güncel UI mimarisi; ~%40 kısalır. (Fine dining slot'ları burada da eksik.) |
| Tarif görselleri | 1173-1222 | **A + B** | Kuyruk/cache zorunlu kuralları **A**; `write(base64)` dersi **B**. |
| Claude structured output | 1224-1252 | **A/D** | Tool-use zorunluluğu **A**; cache_control açıklaması MVP-15/16 anlatımıyla çift. |
| Tarif chat'i | 1254-1259 | **A ama stale** | Koddaki `CHEF_INSTRUCTIONS` farklı + çıktı dili parametrik; `recipe_chats` tablosu yok. |
| Sağlayıcı karşılaştırma: MVP-7 ölçülmedi notu | 1262-1279 | **C** | Bilinen boşluk kaydı; 1 satıra iner. |
| MVP-4/3/2 tabloları + kararlar | 1281-1383 | **C + A/B özü** | Kalacak öz: Gemini varsayılan (neden), ~17x görsel token asimetrisi, `thinking: disabled`, eval script kullanımı. |
| Performans notları (MVP-9) | 1385-1502 | **B + C** | İki cihaz-çökme dersi (**B**, kritik), 720p bulgusu + flash-vs-pro kararı (**B**); tablolar/süreç **C**. |
| Çalışma kuralları | 1503-1515 | **A** | Tamamı aktif. |

**Kaba dağılım (token bazında):** A ≈ %33 (~18K, yeni bloklar dahil) · B özü ≈ %6 (~3K; kısaltılmış haliyle ~1.5K) · C ≈ %46 (~25K) · D ≈ %15 (~8K).

---

## 3. Çelişki ve güvenilirlik taraması

### 3a. Dosya içi çelişkiler / "aktif gibi okunan geçersizler"

1. **Üç farklı cache sürümü:** ENVANTER-2DİL bloğu "v4 → v5" diyor (satır 82, doğru); MVP-22 "v3" (satır 228); MVP-16 "v2" (satır 991). Yalnız en üstteki günceldir; dosyada v4'ün NE olduğu (kilerin parmak izinden çıkarılması) hiç yazmıyor — MVP-22'nin "parmak izi kiler içerir" cümlesi düzeltilmeden duruyor.
2. **Sekme sayısı:** "Mimari" (satır 287) ve "Sayfalar" (316-332) hâlâ **3 sekme + Kayıtlı kapsam dışı** diyor; MVP-23 bloğu **5 sekme** diyor; kod 5 sekme. Alt bölümler hiç güncellenmemiş.
3. **"MVP kapsamı" bölümü** (308-310): "Sadece Kayıtlı sayfası kapsam dışı kaldı" — MVP-23 bunu geçersiz kıldı.
4. **Eski tasarım sistemi** (335-341): stone/emerald/Fraunces maddeleri "Demo'da onaylanan görsel dil. Bundan sapma:" başlığı altında — bölümü tek başına okuyan session yanlış paleti uygular; MVP-22 uyarısı 140+ satır yukarıda.
5. **Tarif sayısı:** MVP-16 "TAM 6 tarif" (satır 927) — kodda toplam 8 (aşağıda). Yeni ENVANTER-2DİL bloğu bile üretim akışını anlatırken fine dining'e değinmiyor.
6. **Tarif chat'i** (1254-1259): "geçmiş `recipe_chats` tablosundan" — tablo yok, geçmiş `store/chefChatStore.ts`'te; sistem talimatı metni koddaki `CHEF_INSTRUCTIONS` ile örtüşmüyor; çıktı dili artık parametrik.

### 3b. Kod doğrulaması — dosyanın dediği vs gerçek

**Yanlış çıkanlar:**

| Dosyanın iddiası | Kodda gerçek |
|---|---|
| "TAM 6 tarif, 3 katman" | `FINE_DINING_COUNT=2` + `RECIPE_COUNT=6` → **8 tarif**; fine dining ayrı bölüm + ayrı detay varyantı (`lib/claude/generateRecipes.ts:23-28`, `app/(tabs)/recipes.tsx:32`) |
| "Parmak izi envanter + tercihler + aktif kiler" (MVP-22) | `recipeStore.ts:26,43`: **v5**, parmak izi = sürüm + tercihler + envanter — kiler v4'te çıkarıldı; dosyada bu değişiklik hiç yok |
| "Supabase HÂLÂ KURULU DEĞİL" | `supabase/migrations/` (pgvector + `match_recipes`) ve `supabase/functions/generate-recipe/` mevcut; `README-rag.md` kurulum rehberi var. Auth/kullanıcı verisi tarafı hâlâ yok — doğrusu "kısmen kuruldu (yalnız RAG)" |
| "3 sekme (Mutfağım · Tarifler · Market)" (Mimari) | 5 sekme: index, recipes, saved, plan, market |
| DB şeması bölümü (5 tablo + RLS) | Bu tabloların hiçbiri yok; var olan tek tablo RAG tarif korpusu (farklı şema) |
| Tarif chat'i: `recipe_chats` tablosu | `store/chefChatStore.ts` (zustand persist) |

**Dosyada hiç olmayan ama kodda olan önemli şeyler:**

- **RAG altyapısı (Blok A):** `EXPO_PUBLIC_USE_RAG` flag'i, `lib/rag/generateRecipesRag.ts`, edge function, embedding script'leri. SKILL.md'deki izler: i18n bloğunda yarım cümle + ENVANTER-2DİL'de "RAG akışı aynı katmandan geçer" cümlesi. Detay `README-rag.md`'de — SKILL.md'ye 4-5 satır + pointer yeter.
- **Fine dining (önceki merge'in İş 1'i):** 6+2 üretim, `FINE_DINING_VARIANT`, `category: 'fine-dining'`, UI'da ayrı bölüm + rozet.
- **Mutfağım son güncelleme tarihleri, ortak sheet backdrop animasyonu + kapanış kilidi, Cookbook `KeyboardAvoidingView`** (önceki merge'in İş 2/3'ü + klavye düzeltmesi).

**Yeni blokların doğrulaması (hepsi doğru çıktı):** `GENERATION_VERSION='v5'` ✓ · `translateTexts` haiku / `translateRecipeTexts` sonnet ✓ · `ImportFlow.tsx`'te çıplak `instagram://` + varyant yorumları ✓ · `tutorialImages.ts` manifest `null` ve `assets/import-tutorial/` henüz yok (graceful fallback iddiasıyla tutarlı) ✓ · `lib/recipes/ingredient-match.ts` (157 satır) + testleri mevcut ✓.

**Önceki analizden bu güncellemeyle çözülenler:** iki dilli envanter/tarif adları artık belgeli (3a/3b/3c); güncel cache sürümü (v5) dosyada mevcut; `computeMissing`'in `namesMatch` kullandığı yazılmış. **Çözülmeyenler:** yukarıdaki tablonun tamamı + eksik konular listesi.

**Doğru çıkanlar (örnekleme):** `CONFIDENCE_THRESHOLD=90` ✓ · `RECIPE_COUNT=6` ✓ · `markdown-table.ts` deprecated ama duruyor ✓ · `[DEBUG] Ham Metni Gör` butonu duruyor ✓ · Fraunces/Outfit hâlâ yükleniyor (modal için) ✓ · eski `extractInventoryFromImages.ts` silinmiş ✓ · `askChef` modeli `claude-sonnet-4-6` ✓ · `propertyOrdering` reasoning→confidence ✓. Teknik detay doğruluğu genel olarak iyi; sorun, "geçersiz kılındı" katmanlarının üst üste binmesi ve büyük değişimlerin (fine dining, RAG) işlenmemesi.

### 3c. Büyüme deseni gözlemi

Yeni merge, dosyanın çalışma şeklini de gösteriyor: her iş "en üste yeni blok" olarak ekleniyor, alt bölümler hiç güncellenmiyor/budanmıyor. Sonuç: doğru bilgi hep en üstte, çürüyen bilgi ortada birikir ve okuyucunun "hangisi güncel?" sorusunu blokların tarihlerinden çıkarması beklenir. Bu desen sürdükçe dosya haftada ~2-3K token büyür — §4'teki bakım kuralı bu yüzden yapının parçası olmalı, tek seferlik temizlik yetmez.

---

## 4. Önerilen hedef yapı

### 4a. Dosya düzeni (progressive disclosure)

```
.claude/skills/yemek-app/
├── SKILL.md                 (~15-17K token) — yalın aktif kurallar + kritik dersler
└── references/
    └── HISTORY.md           — MVP-1→24 kronolojisi, geri alınan denemeler,
                               tüm ölçüm tabloları (C sınıfının tamamı)
```

- SKILL.md, her akış için "güncel davranış + neden + dosya pointer'ı" formatında; "eskiden şöyleydi, sonra şöyle oldu" anlatısı tamamen HISTORY.md'ye.
- MVP-24 detayları → `services/stores/README.md` zaten var; RAG → `README-rag.md` zaten var. SKILL.md bunlara işaret eder, içeriği tekrarlamaz.
- Kökteki `CHANGELOG.md` MVP-4'te terk edilmiş — HISTORY.md yazılırken ya oraya birleştirilmeli ya da "bkz. HISTORY.md" notuyla kapatılmalı.
- **Bakım kuralı dosyaya yazılmalı:** *"Yeni iş = ilgili bölümü GÜNCELLE (üste blok ekleme); geçersiz kılınan anlatı HISTORY.md'ye taşınır; SKILL.md'de yalnız güncel kural kalır."* §3c'deki desen sürerse dosya 6 ay sonra yine 50K+ olur.

### 4b. Taşı / kısalt / birleştir listesi (tahmini token kazancı)

| # | İşlem | Tahmini kazanç |
|---|---|---:|
| 1 | MVP-17→20 tasarım sagası → HISTORY; yerine ~10 satır "nihai kart/yerleşim durumu + yapılmayacaklar" | **~6.800** |
| 2 | Envanter→tarif: MVP-14 bloğu, MVP-15/16 ölçümleri/çeşitlilik listeleri → HISTORY; MVP-15+16 (+fine dining) tek birleşik "güncel üretim akışı" anlatımı | **~5.500** |
| 3 | Sağlayıcı karşılaştırma bölümü → HISTORY; kalan: Gemini-varsayılan kararı + eval script kullanımı (~15 satır) | **~3.600** |
| 4 | Performans notları → HISTORY; kalan: 2 cihaz dersi + 720p/flash bulguları kural formatında (~15 satır) | **~3.600** |
| 5 | MVP-2/3/4/5/6/8 tarihi notları + MVP-12 varyans/MVP-13 skor dökümleri → HISTORY; kalan: şemasız-gözlem dersi + kalibrasyon kuralı | **~3.500** |
| 6 | MVP-22/23/24 blokları "karar özeti"ne indirilir (süreç anlatısı, doğrulama satırları, ilgisiz notlar çıkar; D-tekrarlar ilgili bölümlere devredilir) | **~3.000** |
| 7 | Eski tasarım sistemi maddeleri silinir; eski DB şeması bölümü kaldırılır; MVP-10/8 kapsam anlatıları tekilleştirilir | **~1.800** |
| 8 | Video→envanter + iki aşamalı JSON bölümlerindeki evrim cümleleri temizlenir | **~1.500** |
| 9 | Tarif görselleri + structured output + canlı gösterim sıkılaştırılır (davranış aynı, anlatı yarıya) | **~2.500** |
| 10 | **Yeni 3 blok kural formatına indirilir** (IG-RESUME ~5 satır; IG-EĞİTİM ~%30; ENVANTER-2DİL hata-anlatısı kısaltılıp kurallar ilgili bölümlere gömülür) | **~1.200** |
| 11 | **EKLEME (+):** RAG özeti+pointer, fine dining (6+2), v5 gerekçesi (v4'ün kiler değişikliği dahil), güncel sekmeler/Supabase durumu, backdrop/tarih/klavye tek satırlıkları | **-1.300** |

**Toplam: ~54.000 → ~15-17K token** (kazanç ~37-39K, %68-71). HISTORY.md ~30K token olur ama session başında OKUNMAZ — yalnız "bu neden böyleydi?" gerektiğinde açılır.

### 4c. B sınıfı ders yeniden yazım örnekleri (rapor içi örnek — uygulanmadı)

**Örnek 1 — RN streaming dersi** (şu an ~20 satır, MVP-9 §2):
> **KURAL: `@google/genai` streaming (`generateContentStream`) KULLANMA.** RN'in yerleşik `fetch`'i `response.body`'yi ReadableStream olarak sunmaz → cihazda "Response body is empty" ile çöker; Node/masaüstü testinde YAKALANMAZ. Non-streaming `generateContent` kullan; gerçek streaming istenirse `expo/fetch` ayrı bağımlılık kararıdır.

**Örnek 2 — Blob/upload dersi** (şu an ~26 satır, MVP-9 §1):
> **KURAL: `expo-file-system` `File`'ını `ai.files.upload`'a doğrudan verme.** Chunked upload `File.slice()` → `new Blob([ArrayBuffer])` çağırır; RN'in Blob polyfill'i bunu desteklemez (cihazda çöker, Node'da çalışır). Files API yüklemeleri için base64 → `fetch('data:...;base64,...').blob()` ile RN'in native Blob'u kullanılır (`extractInventoryFromVideoNative`).

**Örnek 3 — IG-RESUME bloğu** (şu an ~13 satır, yeni blok):
> **KURAL: Instagram `instagram://` ÇIPLAK şemayla açılır (path YOK, `ImportFlow.tsx`).** `instagram://app`/`instagram://feed` IG'yi ana feed'e navige edip son durumu sıfırlar (kullanıcı şikayetiydi); path'siz şema iOS'ta yalnız ön plana getirir (resume). IG yoksa catch zinciri web fallback'ine düşer. Expo Go'da gözlemlenemez — gerçek cihaz doğrulaması bekliyor (`// DOĞRULA`).

### 4d. Riskler ve temkin noktaları

1. **"Reddedilen tasarımlar" bilgisi dağınık:** iki eşikli swipe, confidence rozeti ana listede, tik ikonu, içeceklerin envantere girmesi, katman-bağımsız üretim, markanın ada birleştirilmesi, IG `instagram://app` şeması… Taşıma sırasında SKILL.md'de kompakt bir **"Denendi/reddedildi — tekrar önerme"** listesi oluşturulmalı; yoksa en pahalı hata türü (kullanıcının reddettiğini yeniden önermek) geri gelir.
2. **Ölçüm tabloları karar dayanağı:** "flash'a geçelim mi", "video sıkıştıralım mı" tartışmaları açılırsa rakamlar gerekir. Silinmiyor, HISTORY'ye taşınıyor — SKILL.md'deki kural satırları "gerekçe + HISTORY pointer'ı" içermeli.
3. **MVP-22'nin D-tekrarları güvenlik ağı:** blok, alt bölümler güncellenmediği için "geçersiz kılma katmanı" görevi görüyor. Tekrarlar ancak alt bölümler gerçekten güncellendikten SONRA silinmeli — sıra önemli (önce düzelt, sonra tekilleştir).
4. **ENVANTER-2DİL bloğu birden çok bölüme dağılacak:** kuralları (üretim promptu, computeMissing, sepet, cache sürümü) 4 ayrı bölümü ilgilendiriyor. Kısaltırken kurallar ilgili bölümlere gömülmeli; blok olduğu gibi silinip tek yere sıkıştırılırsa "kanonik kaynak orijinal tarif" kuralı görünmez kalabilir (rozet-sepet tutarsızlığı biletinin kök nedeniydi).
5. **Kritik ama "gereksiz detay" sanılabilecek A kuralları:** `propertyOrdering` (reasoning→confidence sırası), `İçecek` enum'unun şemadan silinmemesi, cache breakpoint'inin ilk system bloğu sonunda olması, `lib/`-`services/`'in i18n import etmemesi, "eşleşme yok cache'lenmez", manifest-null/Metro-require kısıtı, "kısmi token örtüşmesi bilinçli eşleşmez". Her biri gerçek bir hatanın önündeki tek set — kısaltmada bilinçli korunmalı.
6. **Tokenizer maliyeti:** Türkçe ~0.52 token/karakter. Kurallar Türkçe kalmalı ama daha az BÜYÜK-HARF vurgusu ve parantez-içi-tekrar ile yazılırsa karakter başına da kazanç var.

---

## Uygulama planı (öncelik sıralı — onay sonrası ayrı session'da)

1. **Doğruluk düzeltmeleri (küçültmeden bağımsız, en acil):** 6→6+2 fine dining (üretim + canlı gösterim bölümleri), MVP-22 parmak izi maddesinin v5'e göre düzeltilmesi (v4 kiler değişikliği dahil; v2/v3 kalıntıları "bkz. v5" olur), Supabase/RAG gerçek durumu + `README-rag.md` pointer'ı, Mimari 3→5 sekme, "Sayfalar"ın 5 sekmeye güncellenmesi, DB şeması bölümünün kaldırılması/etiketlenmesi, tarif chat'inin kodla eşitlenmesi, backdrop/tarih/klavye tek satırlıkları. (~1 saatlik iş; dosya %2 büyür ama yalan söylemez.)
2. **`references/HISTORY.md` oluştur, C sınıfını taşı:** §4b'deki 1-5 ve 8 numaralı kalemler; her taşınan bloğun yerine tek satır pointer. `CHANGELOG.md` kararını burada ver (birleştir veya kapat).
3. **B sınıfını kural formatına indir:** §4c örnek formatıyla (~12 ders); her kural = 2-3 satır + gerekçe + gerekirse HISTORY pointer'ı. Yeni 3 blok da bu adımda kural formatına iner (ENVANTER-2DİL kuralları ilgili bölümlere gömülür).
4. **D tekrarlarını tekilleştir + MVP bloklarını karar özetine indir:** MVP-22/23/24 blokları kısalır (adım 1'de alt bölümler güncellendiği için artık güvenli); "Denendi/reddedildi" listesi eklenir; **bakım kuralı** ("yeni iş = bölümü güncelle, üste blok ekleme; geçersiz anlatı → HISTORY") dosyaya yazılır.
5. **Doğrulama:** yeni SKILL.md kodla çapraz tarama (bu rapordaki §3b kontrol listesi yeniden koşulur), toplam token ölçümü rapor edilir, önce/sonra karşılaştırmasıyla kullanıcı onayına sunulur.
