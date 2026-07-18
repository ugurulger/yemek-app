/**
 * Dil değişimi senkronu (kullanıcı kararı — "dil değişiminde topyekün
 * karşılığını koymalıyız"): EN/TR seçici dili değiştirdiğinde,
 *
 * 1. Envanterde hedef dil karşılığı eksik ürün adları toplu çevrilir
 *    (bkz. inventoryI18n.backfillInventoryTranslations — tarama sonrası
 *    çeviri adımının emniyet ağı),
 * 2. Mevcut tariflerin hedef dildeki metinleri üretilir
 *    (bkz. recipeI18n.ensureRecipeTranslations — İLK geçişte çevrilir,
 *    cache'lenir; sonraki geçişler anında).
 *
 * İkisi de arka planda koşar ve hataya toleranslıdır — çeviri gelene kadar
 * UI orijinal dildeki metni göstermeye devam eder, çeviri store'a yazılınca
 * ekranlar kendiliğinden yenilenir.
 */
import i18n, { type AppLanguage } from './index';
import { backfillInventoryTranslations, backfillPantryTranslations } from './inventoryI18n';
import { ensureRecipeTranslations } from './recipeI18n';

let initialized = false;

export function initLanguageSync(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  i18n.on('languageChanged', (lng) => {
    const language: AppLanguage = lng === 'tr' ? 'tr' : 'en';
    void backfillInventoryTranslations(language).catch((error) => {
      console.warn('[i18n] envanter çeviri backfill hatası:', error);
    });
    void backfillPantryTranslations(language).catch((error) => {
      console.warn('[i18n] kiler çeviri backfill hatası:', error);
    });
    void ensureRecipeTranslations(language).catch((error) => {
      console.warn('[i18n] tarif çeviri hatası:', error);
    });
  });
}
