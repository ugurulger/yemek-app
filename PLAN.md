# Yemek App — MVP Master Planı

**Hedef:** Fotoğraf/video ile ürün tanıma + envanterden kaliteli tarif üretimi.
**Tek nokta:** Tüm geliştirme Claude Code içinden. Demo kendi telefonunda (Expo Go).
**Tahmini süre:** 3–5 gün, günde 2–3 saat.

---

## Faz 0 — Kurulum (1 saat, tek seferlik)

Bilgisayarda:
1. Node.js LTS kur → `npm install -g @anthropic-ai/claude-code`
2. Boş klasör aç, içinde `claude` komutuyla Claude Code'u başlat
3. `.claude/skills/yemek-app/SKILL.md` dosyasını koy (hazır)
4. console.anthropic.com'dan API anahtarı al (MVP'de Edge Function yerine
   geçici olarak `.env` dosyasında tutulabilir — store'a çıkmadan önce taşınır)

Telefonda:
5. App Store/Play Store'dan **Expo Go** indir

Claude Code'a ilk komut:
> "SKILL.md'yi oku. Expo + TypeScript projesi kur, expo-router ile 2 sekmeli
> iskelet oluştur (Mutfağım, Tarifler). Tasarım sistemini uygula ve
> `npx expo start` ile çalıştır."

Telefonla QR kodu okut → uygulama telefonunda canlı. Bundan sonra her kod
değişikliği telefona anında yansır (hot reload).

## Faz 1 — Fotoğraf/Video → Envanter (1–2 gün)

Sıra önemli; her adım telefonda test edilerek geçilir:

1. **Envanter UI** — mock veriyle liste, miktar +/-, silme (demo'daki gibi)
2. **Fotoğraf akışı** — `expo-image-picker` ile kamera/galeri →
   base64 → Claude API → JSON parse → envantere yazma
3. **Video akışı** — `expo-video-thumbnails` ile kare çıkarma (sn'de 1,
   maks 8 kare) → tek istekte çoklu görüntü → tekilleştirilmiş ürün listesi
4. **Kalıcılık** — MVP'de Supabase YOK; `AsyncStorage` yeterli
   (tek kullanıcı, tek cihaz). Supabase, çoklu cihaz gerektiğinde eklenir.

**Kalite kapısı:** Kendi buzdolabınla 5 deneme → en az 4'ünde ürünlerin
%80'i doğru tanınmalı. Değilse koda değil, vision prompt'una odaklan
(Claude Code'a "şu fotoğrafta X'i kaçırdı, prompt'u iyileştir" de).

## Faz 2 — Envanter → Kaliteli Tarifler (1–2 gün)

1. **Tarif üretimi** — envanter listesi → Claude API → 4-6 tarif (JSON)
2. **Tarif kartları + detay** — kalori, kişi, süre, makrolar, uyum yüzdesi,
   adım adım hazırlanış (demo'daki UI)
3. **Kalite iyileştirme döngüsü** — MVP'nin asıl değeri burada:
   - Prompt'a kural ekle: "yalnızca envanterdeki + temel kiler malzemelerini
     (tuz, yağ, un) kullan", "Türk mutfağına öncelik ver", "gerçekçi süre
     ve kalori ver"
   - 10 farklı envanterle test et, kötü tarifleri not al, prompt'u güncelle
   - Gerekirse iki aşamalı üretim: önce tarif isimleri, sonra seçilenin detayı
     (daha hızlı ve ucuz)

**Kalite kapısı:** Ürettiği 3 tariften en az 2'sini gerçekten pişirmek
isteyecek kalitede buluyorsan MVP tamam.

## Faz 3 — Cila ve demo (yarım gün)

- Yükleme durumları ("Buzdolabı analiz ediliyor…"), hata durumları,
  boş durumlar
- Uygulama ikonu + açılış ekranı (Claude Code'a yaptır)
- Telefonda uçtan uca test: video çek → envanter → tarif → beğen

## MVP sonrası (sıralı)

1. Tarif başına AI chat → 2. Kayıtlı yemekler → 3. Alışveriş sepeti →
4. Supabase (hesap + çoklu cihaz) → 5. Edge Function'a API anahtarı taşıma →
6. EAS Build ile store'a çıkış

---

## Çalışma prensipleri

- **Her oturum tek iş:** "Faz 1, adım 2'yi yap" gibi net komutlar ver;
  bitince telefonda test et, sonra devam.
- **Sorun olduğunda ekran görüntüsünü Claude Code'a yapıştır** — hata
  metni veya UI sorunu, ikisinde de en hızlı çözüm yolu bu.
- **Prompt kalitesi = ürün kalitesi:** Bu MVP'de kodun %70'i bir kere
  yazılıp bitecek; zamanın çoğunu vision ve tarif prompt'larını
  iyileştirmeye ayır.
