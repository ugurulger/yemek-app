/**
 * Tasarım sistemi renk sabitleri — TEK KAYNAK: design/reference/
 * Mutfagim.dc.html (tasarımın gerçek kaynak kodu; PNG'ler ondan üretildi).
 * Değerler oradan BİREBİR kopyalanır, görsel yorum yapılmaz.
 *
 * className kullanılamayan yerler için (ikon renkleri, tab bar,
 * shadowColor, Animated stiller vb.). Tailwind karşılıkları
 * tailwind.config.js'te aynı adlarla tanımlıdır.
 */
export const colors = {
  // Birincil orman yeşili
  forest: '#1F4A3D',
  forestDark: '#2E5F4E',
  // Zeminler
  cream: '#F7F5F0', // sayfa zemini
  sand: '#EDEAE3', // sayfa dışı / nötr
  card: '#FFFFFF', // kart zemini
  // Metin tonları
  ink: '#23302B', // başlık / koyu
  body: '#3A463F', // gövde metni
  muted: '#8A9088',
  muted2: '#96A199',
  // Amber (eksik/rozet)
  amber: '#E38A2A', // dolgu
  amberText: '#B26A16',
  amberSoft: '#FBE6C9', // açık zemin
  // Şef tüyosu kutusu
  cheftipBg: '#EFEAD9',
  cheftipTitle: '#8A6B1F',
  cheftipText: '#5C5230',
  // Makro noktaları
  macroProtein: '#1F4A3D',
  macroKarb: '#E38A2A',
  macroYag: '#C9A24B',
  // Buzdolabı kategori pastel tint'leri
  tintSut: '#F3DEE4', // Süt & Peynir
  tintEt: '#F7E0D6', // Et & Şarküteri
  tintSebze: '#E5EEDD', // Meyve & Sebze
  tintDiger: '#F4ECCB', // Diğer
  // Tarif etiketi (market)
  recipetagBg: '#F6EFE7',
  recipetagText: '#A9846B',
  // Yumuşak yeşil sayaç pili ("N tarif") + asistan ikon zemini
  softGreenBg: '#DCEEE3',
  softGreenText: '#2E7D5B',
  // Soluk yeşil pill zemini (makro pilleri, stepper − butonu, mic idle)
  pillBg: '#EFF3EC',
  // Malzeme satırı miktar/kcal metni
  qtyMuted: '#98A29A',
  // Malzeme satırı başındaki nokta
  ingredientDot: '#C7D0C9',
  // Market checkbox çerçevesi (işaretsiz)
  checkboxBorder: '#CBD3CD',
  // İşaretlenmiş (üstü çizili) satır metni
  checkedText: '#A9B0AB',
  // Çöp/sil ikonu
  trashIcon: '#C7B7A8',
  // Tab bar
  tabInactive: '#B4BBB4',
  tabBarBg: 'rgba(247,245,240,0.92)', // krem yarı saydam (referans BOTTOM NAV)
  tabBarBorder: 'rgba(31,74,61,0.08)',
  // Ayraç çizgileri (referansta satır ayraçları 1px rgba(31,74,61,.07))
  divider: 'rgba(31,74,61,0.07)',
  // Chip çerçevesi (seçili değilken): normal .22, kompakt .2
  chipBorder: 'rgba(31,74,61,0.22)',
  chipBorderSm: 'rgba(31,74,61,0.2)',
  // Foto placeholder etiket rengi
  photoLabel: 'rgba(31,74,61,0.4)',
  // Kart görseli alt bilgi şeridi zemini (gradient yerine düz yaklaşım)
  photoStripBg: 'rgba(20,30,25,0.55)',
} as const;

/**
 * Foto placeholder şerit tonları — referanstaki tarif `photo:[t1,t2]`
 * çiftleri (repeating-linear-gradient 135deg, 16px şerit). Tarif adına göre
 * deterministik seçilir.
 */
export const photoTones: readonly [string, string][] = [
  ['#F3C48A', '#EBAE6A'],
  ['#D9C79E', '#C6B080'],
  ['#EBA77F', '#DE8E62'],
  ['#E8B27A', '#D89A5C'],
  ['#E0C79A', '#CDAF77'],
  ['#D6A96A', '#C29350'],
  ['#C79B6B', '#B0834F'],
  ['#D8B36C', '#C39D52'],
] as const;

/** Ortak kart gölgesi: 0 2px 10px -4px rgba(31,74,61,.12) yaklaşımı. */
export const cardShadow = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 5,
  elevation: 3,
} as const;

/** Tipografi font aileleri (tailwind fontFamily ile aynı). */
export const fonts = {
  serif: 'Newsreader_500Medium',
  sans: 'HankenGrotesk_400Regular',
  sansMedium: 'HankenGrotesk_500Medium',
  sansSemibold: 'HankenGrotesk_600SemiBold',
} as const;
