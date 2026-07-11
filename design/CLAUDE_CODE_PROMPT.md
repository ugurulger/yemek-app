# Yemek Uygulaması — Claude Code Entegrasyon Promptu

> Aşağıdaki ekranları **mevcut projemize** entegre et. Bu bir referans tasarımdır (görünüm birebir korunmalı). Ekran görselleri bu klasördedir (`01…11-*.png`). Görünümü, renkleri, tipografiyi ve etkileşimleri sadık şekilde uygula; mevcut proje mimarisine (component yapısı, routing, state) yerleştir.

Bu görevi **alt-agent'lara** aşağıdaki gibi böl ve paralel çalıştır. Her agent kendi ekranını/sorumluluğunu üstlensin; `design-system-agent` önce çalışsın, `integration-agent` en son.

---

## 0) Kısa Kullanıcı Akışı

1. **Mutfağım (Envanter)** — kullanıcı elindeki malzemeleri görür/yönetir. Malzeme eklemek için iki yol: **Kamerayla tara** (video ile buzdolabını tarat) veya **Asistanla ekle** (yazarak veya sesle).
2. **Tarifler** sekmesine geçince önce **tek ekranlık tercih ekranı** açılır (chip'lerle profil/zaman/lezzet/yöntem — hepsi opsiyonel). **İleri** → tarifler üretilir.
3. **Tarif listesi** iki bölüm: *Hemen Yapabilirsin* ve *Küçük Bir Alışverişle* (eksik malzeme rozetli).
4. Bir karta tıklayınca **Tarif Detayı**: kişi sayısı ayarlanınca malzeme miktarı + kalori ölçeklenir; eksik malzemeler işaretli; en altta **Şefe Sor** AI sohbeti (malzeme değişimi vb.).
5. **Market** sekmesi: seçilen tariflerdeki eksik malzemelerin kategorilere ayrılmış alışveriş listesi → **Tümünü tamamla**.

Alt navigasyon 3 sekme: **Mutfağım · Tarifler · Market**.

---

## 1) `design-system-agent` — Tasarım Sistemi (önce çalışır)

Tüm ekranlar bu tokenları paylaşır. Merkezi tema + ortak bileşenler oluştur.

**Renkler**
- Primary (orman yeşili): `#1F4A3D`, koyu varyant `#2E5F4E`
- Zemin krem: `#F7F5F0`; sayfa dışı/nötr: `#EDEAE3`
- Metin: başlık/koyu `#23302B`, gövde `#3A463F`, muted `#8A9088` / `#96A199`
- Kart: `#FFFFFF`
- Amber (eksik/rozet): dolgu `#E38A2A`, metin `#B26A16`, açık zemin `#FBE6C9`
- Şef tüyosu kutusu: zemin `#EFEAD9`, başlık `#8A6B1F`, metin `#5C5230`
- Makro noktaları: protein `#1F4A3D`, karbonhidrat `#E38A2A`, yağ `#C9A24B`
- Buzdolabı kategori pastel tint'leri: Süt&Peynir `#F3DEE4`, Et&Şarküteri `#F7E0D6`, Meyve&Sebze `#E5EEDD`, Diğer `#F4ECCB`
- Tarif etiketi (market): zemin `#F6EFE7`, metin `#A9846B`
- Ayraç çizgileri: `rgba(31,74,61,0.07–0.12)`

**Tipografi**
- Başlıklar: **Newsreader** (serif), weight 500 — sayfa başlıkları 31–34px, bölüm başlıkları 19–21px
- Gövde/UI: **Hanken Grotesk** (sans), 400–600
- Kategori etiketleri: UPPERCASE, letter-spacing ~.6px, muted, 10–11px

**Ölçek/şekil**
- Kart radius 16–22px, gölge `0 2px 10px -4px rgba(31,74,61,.12)`
- Buton radius 14–18px; primary buton dolu yeşil + beyaz metin
- Cömert boşluk, ferah düzen; kutu/çerçeve kalabalığından kaçın

**Ortak bileşenler**
- **Chip** (seçilebilir): seçili = dolu `#1F4A3D` + beyaz metin, radius 15–20; seçili değil = 1px outline `rgba(31,74,61,.2)` + beyaz zemin + muted metin. İki boy: *normal* (12px, padding 8×12) ve *kompakt* (11px, padding 5×9).
- **Kart** (beyaz, yuvarlak, yumuşak gölge)
- **Eksik rozeti** (amber pill)
- **Alt navigasyon** (3 sekme, bulanık/blur zemin, aktif `#1F4A3D`, pasif `#B4BBB4`)
- **Fotoğraf placeholder**: diagonal `repeating-linear-gradient` iki pastel ton + monospace açıklama etiketi (gerçek fotoğraf gelince değişir). Üstünde kalori rozeti, altında bilgi şeridi. *(Gerçek görseller entegre edilecekse slot bırak.)*

---

## 2) `inventory-agent` — Ekran: Mutfağım / Envanter
Görsel: `01-mutfagim-envanter.png`, `02-mutfagim-temel-malzemeler.png`

- Serif "Mutfağım" başlığı + selamlama.
- Başlığın hemen altında (Buzdolabım başlığının altında) iki kompakt buton: **Kamerayla tara** (yeşil dolu) ve **Asistanla ekle** (açık). Bunlar `capture-input-agent` ekranlarını açar.
- **Buzdolabım** bloğu: iki-sütun kartlar (Süt & Peynir 🧀, Et & Şarküteri 🥩, Meyve & Sebze 🥬, Diğer 🥚). Her satır: ürün adı + silme (çöp) ikonu. Kategori başlığında pastel tint'li emoji rozeti.
- **Temel Malzemeler** bloğu (ayrı, altta): chip-seçim düzeni, kategorilere ayrık (Baharatlar, Yağlar, Kiler, Bakliyat & Makarna, Sebze Bazları). Bunlar varsayılan "evde var" kabul edilir; minimal yönlendirme metni: ev ikonu + "Evinde hep var sayıyoruz — olmayana dokunup çıkar". Bloğa özel **Asistanla ekle** butonu (sağ üst).
- Chip'e dokunmak seçili/pasif (var/yok) toggle yapar.

## 3) `capture-input-agent` — Malzeme Ekleme Ekranları
Görsel: `03-ekle-kamera.png`, `04-ekle-asistan.png`

- **Kamera**: tam ekran koyu kamera görünümü; ortada/altta büyük yuvarlak **basılı-tut** kayıt butonu, çevresinde 10 saniyeye kadar dolan ilerleme halkası (story tarzı). Sağ altta "galeriden video seç" ikonu, sol üstte kapat.
- **Asistanla ekle**: dikey/yatay ortada sabit arama çubuğu; çubuğun sağında minimal ama belirgin **mikrofon** butonu (dokununca "Dinliyorum…" + nabız animasyonu → sesle giriş). Yazarak veya sesle giriş. Girişten sonra AI'ın ayrıştırdığı malzemeler **seçilebilir chip** olarak aşağı doğru dinamik akar; kullanıcı seçip **Ekle** ile envantere ekler.

## 4) `recipes-agent` — Tercih Ekranı + Tarif Listesi
Görsel: `05-tarifler-tercih.png`, `06-tarifler-tercih-devam.png`, `07-tarifler-liste.png`

- **Tercih ekranı** (tarifler üretilmeden önce): başlık "Nasıl bir tarif istersin?", "boş bırak — farketmez" notu. 4 kategori, her biri sade başlık + yatay saran chip'ler (kutu yok):
  - **Hedeflenen Profil**: Protein Odaklı · Enerji Deposu · Metabolik Denge · Ketojenik Mod · Definasyon
  - **Zamanlama & Amaç**: Güne Başlangıç · Performans Öncesi · Toparlanma · Gün Boyu Stabil · Gece Onarımı
  - **Lezzet & Doku**: Çıtır · Yumuşak & Kremamsı · Baharatlı & Keskin · Taze & Ferah · Doyurucu
  - **Pişirme Yöntemi**: Pratik & Hızlı · Sağlıklı Fırın · Buhar & Haşlama · Yavaş Pişirme · Çiğ & Karma
  - Çoklu/serbest seçim, hiçbiri zorunlu değil. Altta tam genişlik sabit **İleri** butonu → liste.
- **Tarif listesi**: iki bölüm — *Hemen Yapabilirsin* ve *Küçük Bir Alışverişle*. 2 sütunlu kart grid'i, büyük fotoğraf. Fotoğrafın sağ üstünde **kalori/kişi** rozeti; altında yarı saydam şeritte **süre · zorluk · beslenme etiketi** (Protein/Enerji/Lifli/Hafif/Dengeli/Onarım). "Küçük Bir Alışverişle" kartlarında sol üstte amber **"X eksik"** rozeti. Sağ üstteki yenile butonu tercihlere geri döner.

## 5) `recipe-detail-agent` — Tarif Detayı
Görsel: `08-tarif-detay.png`, `09-tarif-detay-malzemeler.png`, `10-tarif-detay-hazirlanis-chat.png`

- Üstte geri butonu, büyük fotoğraf, serif başlık. Varsa amber "X eksik" rozeti (yüzde gösterme).
- Kompakt tek satır makro: Protein / Karbonhidrat / Yağ (ince inline pill'ler).
- **Malzemeler başlığının üstünde kişi sayısı stepper** (− / +). Değiştikçe her malzemenin **miktarı ve tekil kalorisi orantılı ölçeklenir**.
- Malzeme listesi: her satırda ad + "miktar · kcal"; envanterde olmayanlarda amber **eksik** rozeti.
- Numaralı **Hazırlanışı** adımları + krem zeminli **Şef Tüyosu** kutusu.
- En altta **Şefe Sor** AI sohbeti: sayfanın en altına sabit metin giriş çubuğu; malzeme değişimi/tarif soruları. (Örn. "krema yok" → alternatif önerir.)

## 6) `market-agent` — Market Sepeti
Görsel: `11-market-sepeti.png`

- Seçilen tariflerdeki eksik malzemelerin kategorilere ayrık alışveriş listesi. **İki liste yan yana** (2 sütun), kompakt satırlar.
- Her satır: checkbox + ad + adet + hangi tariften geldiğini gösteren küçük etiket. İşaretlenince üstü çizili/soluk.
- Üstte toplam ürün sayısı; altta tam genişlik **Tümünü tamamla** butonu.

## 7) `integration-agent` — Entegrasyon (en son)

- 3 sekmeli alt navigasyon + routing.
- **State/veri akışı**: envanter (buzdolabı + temel malzemeler) → tarif eşleştirme (eksik hesabı) → market listesi. Kişi sayısı ölçekleme mantığı detay ekranında.
- Ekranları mevcut projenin component/klasör düzenine ve stack'ine (React vb.) yerleştir; tasarım tokenlarını `design-system-agent` çıktısıyla paylaş.
- Tüm metinler **Türkçe** kalmalı; görünüm ekran görselleriyle birebir tutulmalı.

---

### Notlar
- Fotoğraflar şu an placeholder (dokulu). Gerçek yemek/ürün görselleri için slot bırak.
- İkonlar sade çizgi (stroke) stilinde; emoji yalnızca kategori rozetlerinde kullanıldı.
