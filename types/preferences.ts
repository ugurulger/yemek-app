/**
 * Tarif tercihleri — spec §4, görseller `05/06-tarifler-tercih*.png`.
 * 4 kategori, hepsi opsiyonel çoklu seçim; boş bırakılabilir ("farketmez").
 * Seçimler `generateRecipes` promptuna yönlendirme olarak eklenir ve tarif
 * cache parmak izine dahildir (tercih değişince tarifler yeniden üretilir).
 */
export const PREFERENCE_SECTIONS = [
  {
    id: 'profil',
    title: 'Hedeflenen Profil',
    options: ['Protein Odaklı', 'Enerji Deposu', 'Metabolik Denge', 'Ketojenik Mod', 'Definasyon'],
  },
  {
    id: 'zamanlama',
    title: 'Zamanlama & Amaç',
    options: ['Güne Başlangıç', 'Performans Öncesi', 'Toparlanma', 'Gün Boyu Stabil', 'Gece Onarımı'],
  },
  {
    id: 'lezzet',
    title: 'Lezzet & Doku',
    options: ['Çıtır', 'Yumuşak & Kremamsı', 'Baharatlı & Keskin', 'Taze & Ferah', 'Doyurucu'],
  },
  {
    id: 'yontem',
    title: 'Pişirme Yöntemi',
    options: ['Pratik & Hızlı', 'Sağlıklı Fırın', 'Buhar & Haşlama', 'Yavaş Pişirme', 'Çiğ & Karma'],
  },
] as const;

export type PreferenceSectionId = (typeof PREFERENCE_SECTIONS)[number]['id'];

/** Kategori id → seçili chip metinleri. Boş dizi = o kategoride tercih yok. */
export type RecipePreferences = Record<PreferenceSectionId, string[]>;

export const EMPTY_PREFERENCES: RecipePreferences = {
  profil: [],
  zamanlama: [],
  lezzet: [],
  yontem: [],
};

export function hasAnyPreference(prefs: RecipePreferences): boolean {
  return PREFERENCE_SECTIONS.some((section) => prefs[section.id].length > 0);
}

/** Deterministik metin — cache parmak izi ve prompt interpolasyonu için. */
export function preferencesFingerprint(prefs: RecipePreferences): string {
  return PREFERENCE_SECTIONS.map(
    (section) => `${section.id}:${[...prefs[section.id]].sort().join(',')}`
  ).join('|');
}
