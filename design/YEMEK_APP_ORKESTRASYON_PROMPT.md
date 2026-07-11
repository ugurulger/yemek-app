# Yemek Uygulaması — Entegrasyon Görevi (Orkestrasyon Promptu)

Bu klasörde 11 ekran görseli (`01…11-*.png`) ve görsel spesifikasyon dosyası (`CLAUDE_CODE_PROMPT.md`) var. Görev: bu tasarımı **mevcut projeye** entegre etmek ve çalışan bir **backend/servis katmanı** kurmak. İşi aşağıdaki fazlara göre planla ve sub-agent'lara paralel dağıt.

`CLAUDE_CODE_PROMPT.md` **görsel spec'tir ve bağlayıcıdır**: renkler, tipografi, bileşenler, ekran davranışları oradan uygulanır. Bu dosya ise **nasıl çalışacağını** tanımlar. Çelişki olursa görünüm konularında spec, mimari konularda bu dosya kazanır.

---

## Faz 0 — Keşif ve Plan (sen yaparsın, agent'a devretme)

1. `.claude/skills/yemek-app/SKILL.md` dosyasını oku ve içindeki kurallara uy.
2. Mevcut proje yapısını tara: stack, routing, state yönetimi, mevcut component/klasör düzeni, backend/API varsa mevcut endpoint'ler, kullanılan paketler.
3. Bulgularına göre kısa bir entegrasyon planı çıkar: hangi mevcut dosyalar değişecek, neler yeni eklenecek, sub-agent dağılımı ne olacak.
4. **Planı bana özetle ve onayımı al, sonra kodlamaya başla.** Mevcut çalışan özellikleri bozacak bir değişiklik gerekiyorsa özellikle belirt.

## Faz 1 — Ortak Sözleşmeler (paralel işten ÖNCE, tek agent)

Frontend ve backend agent'ları paralel çalışacağı için önce ortak kontratları tek dosyada sabitle:

**`contracts-agent`** şunları tanımlar (projenin diline göre TS types / şema olarak):

- **Veri modelleri:** `Ingredient` (id, ad, kategori, miktar?, birim?), `PantryItem` (temel malzeme, aktif/pasif), `Recipe` (id, ad, süre, zorluk, kcal/kişi, makrolar, beslenme etiketi, malzemeler[miktar+kcal], adımlar, şef tüyosu), `RecipePreferences` (4 kategori chip seçimleri), `CartItem` (malzeme, adet, kaynak tarifler[], tamamlandı).
- **Servis arayüzleri (API kontratı):**
  - `parseIngredients(text | audioTranscript) → Ingredient[]` — asistanla ekleme
  - `scanVideo(video) → Ingredient[]` — kamera taraması (MVP'de stub/mock kabul; arayüzü şimdi sabitle)
  - `generateRecipes(inventory, pantry, preferences) → { canMakeNow: Recipe[], needsShopping: Recipe[] }`
  - `askChef(recipeId, chatHistory, message) → reply` — Şefe Sor
  - Envanter CRUD ve sepet işlemleri
- **Eksik malzeme hesabı ve kişi ölçekleme** saf fonksiyon olarak tanımlanır (UI'dan bağımsız, test edilebilir): `computeMissing(recipe, inventory, pantry)`, `scaleServings(recipe, n)`.

Bu kontratlar yazıldıktan sonra diğer agent'lar SADECE bunlara karşı kod yazar.

## Faz 2 — Paralel Çalışma

### Frontend agent'ları (spec'teki bölümlemeyi aynen kullan)
1. `design-system-agent` — tema tokenları + ortak bileşenler (spec §1). **Diğer frontend agent'larından önce biter.**
2. `inventory-agent` — spec §2 (`01`, `02`)
3. `capture-input-agent` — spec §3 (`03`, `04`)
4. `recipes-agent` — spec §4 (`05`, `06`, `07`)
5. `recipe-detail-agent` — spec §5 (`08`, `09`, `10`)
6. `market-agent` — spec §6 (`11`)

Her frontend agent'ı gerçek servis yerine Faz 1 kontratlarına uyan **mock servis** ile geliştirir; entegrasyonda gerçeğine bağlanır.

### `backend-agent` (frontend ile paralel)
- Faz 1'deki servis arayüzlerini gerçekler.
- **AI çağrıları:** `parseIngredients`, `generateRecipes` ve `askChef` LLM tabanlı olacak. Projede halihazırda bir AI entegrasyonu/anahtar yönetimi varsa onu kullan; yoksa nasıl kurmak istediğimi bana sor — API anahtarını asla koda gömme.
- `generateRecipes` çıktısı kontrat şemasına uyan **structured output** olmalı (JSON şema doğrulaması + hatalı çıktıda retry).
- **Kalıcılık:** envanter, temel malzeme durumu ve sepet cihazda kalıcı olmalı (projedeki mevcut storage yaklaşımını kullan; yoksa en basit uygun çözümü öner).
- Video tarama MVP'de mock/stub kalabilir; arayüz kontratta hazır dursun.

## Faz 3 — `integration-agent` (en son)
- 3 sekmeli alt navigasyon + routing (spec §7).
- Mock servisleri gerçek backend'e bağla.
- Veri akışını uçtan uca kur: envanter → tarif üretimi (tercihlerle) → eksik hesabı → sepet toplama (aynı malzeme birden çok tariften geliyorsa birleştir, kaynak tarifleri etikette göster).
- Kişi sayısı değişince malzeme miktarı + tekil kalori ölçeklenir (detay ekranı).

## Faz 4 — `verification-agent`
- Build + lint + varsa mevcut testler geçmeli.
- `computeMissing` ve `scaleServings` için birim testleri yaz.
- Ekran başına görsele karşı manuel kontrol listesi çıkar (renk, tipografi, chip durumları, rozetler) ve sonucu raporla.
- Bana kısa bir tamamlanma raporu ver: ne yapıldı, ne mock kaldı, bilinen eksikler.

---

## Bana Sorman Gereken Açık Noktalar (kendin karar verme)

1. **Tarif → sepet akışı:** Market ekranı birden çok tarifin eksiklerini gösteriyor, ama tarif detayında görünür bir "sepete ekle / bu tarifi seç" aksiyonu tasarımda yok. Bu aksiyonun nerede ve nasıl görüneceğini bana sor (öneri getirebilirsin).
2. **Kişi sayısı ↔ sepet:** Detayda kişi sayısı değişince sepete giden eksik miktarlar da ölçeklensin mi?
3. AI sağlayıcısı/anahtar yönetimi projede hazır değilse kurulum tercihi.

## Genel Kurallar
- Tüm kullanıcı metinleri **Türkçe**.
- Görünüm ekran görselleriyle birebir; fotoğraflar placeholder (spec'teki diagonal doku), gerçek görsel için slot bırak.
- Mevcut projenin convention'larına uy; gereksiz yeni bağımlılık ekleme, eklemen gerekiyorsa gerekçesiyle planda belirt.
- Her faz sonunda kısa durum özeti ver.
