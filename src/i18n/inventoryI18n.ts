/**
 * Envanter adlarının iki dilli yaşam döngüsü (BLOK B devamı):
 *
 * - Tarama/çıkarım SONRASI `bilingualizeItems` karşı dili tek toplu çeviri
 *   çağrısıyla doldurur (video akışı hangi dilde başlatıldıysa API çağrısı o
 *   dilde yapılır — bkz. services/vision/prompt.ts; çeviri adımı burada).
 * - Dil DEĞİŞİMİNDE `backfillInventoryTranslations` eksik karşılıkları
 *   tamamlar (eski kayıtlar + asistanla eklenenler için emniyet ağı) — bkz.
 *   src/i18n/languageSync.ts.
 * - Gösterim `inventoryDisplayName` üzerinden yapılır; VERİ (`item.name`)
 *   değişmez — eşleştirme/prompt akışları name'i kullanmaya devam eder.
 * - `expandInventoryForMatching` / `expandPantryForMatching`: computeMissing
 *   (lib/recipes/recipe-math.ts, SAF kalır) çağrılarına iki dildeki ad
 *   varyantlarını da vermek için — EN tarif malzemesi TR envanter adıyla da
 *   eşleşebilsin diye.
 */
import i18n, { getAppLanguage, type AppLanguage } from './index';
import { pantryItemKey } from './labels';

import { translateTexts, type TranslationLanguage } from '@/lib/claude/translate';
import { useInventoryStore } from '@/store/inventoryStore';
import { usePantryStore } from '@/store/pantryStore';
import type { InventoryItem } from '@/types/inventory';
import type { PantryItem } from '@/types/pantry';

function toTranslationLanguage(language: AppLanguage): TranslationLanguage {
  return language === 'tr' ? 'Turkish' : 'English';
}

/** Aktif uygulama diline göre gösterim adı — karşılık yoksa `name`e düşer. */
export function inventoryDisplayName(
  item: Pick<InventoryItem, 'name' | 'nameTr' | 'nameEn'>
): string {
  return (getAppLanguage() === 'tr' ? item.nameTr : item.nameEn) ?? item.name;
}

/**
 * Çıkarım sonrası (video/fotoğraf/asistan) ürün adlarının karşı dildeki
 * halini TEK toplu çağrıyla üretir. Çeviri başarısız olursa akış BOZULMAZ —
 * yalnızca kaynak dil alanı doldurulmuş kopya döner (karşılık dil değişiminde
 * backfill ile tamamlanır).
 */
export async function bilingualizeItems(
  items: InventoryItem[],
  sourceLanguage: AppLanguage
): Promise<InventoryItem[]> {
  const sourceField = sourceLanguage === 'tr' ? 'nameTr' : 'nameEn';
  const targetField = sourceLanguage === 'tr' ? 'nameEn' : 'nameTr';
  const targetLanguage: AppLanguage = sourceLanguage === 'tr' ? 'en' : 'tr';

  const withSource = items.map((item) => ({ ...item, [sourceField]: item.name }));
  try {
    const translations = await translateTexts(
      withSource.map((item) => item.name),
      toTranslationLanguage(targetLanguage)
    );
    return withSource.map((item, index) => ({ ...item, [targetField]: translations[index] }));
  } catch (error) {
    console.warn('[i18n] envanter adı çevirisi başarısız — kaynak dille devam:', error);
    return withSource;
  }
}

/**
 * Dil değişiminde, hedef dil karşılığı OLMAYAN envanter kayıtlarını tek toplu
 * çeviriyle tamamlar ve store'a yazar (bkz. inventoryStore.applyNameTranslations).
 * Hata durumunda sessizce vazgeçer — gösterim `name`e düşmeye devam eder.
 */
export async function backfillInventoryTranslations(targetLanguage: AppLanguage): Promise<void> {
  const { items, applyNameTranslations } = useInventoryStore.getState();
  const targetField = targetLanguage === 'tr' ? 'nameTr' : 'nameEn';
  const missing = items.filter((item) => !item[targetField]);
  if (missing.length === 0) {
    return;
  }

  const translations = await translateTexts(
    missing.map((item) => item.name),
    toTranslationLanguage(targetLanguage)
  );
  applyNameTranslations(
    missing.map((item, index) => ({ id: item.id, [targetField]: translations[index] }))
  );
}

/**
 * computeMissing'in envanter parametresi için ad varyantlarını genişletir:
 * her ürün, bilinen TÜM dillerdeki adlarıyla (name/nameTr/nameEn — tekilleşmiş)
 * ayrı satırlar olarak döner. computeMissing yalnızca `name` okuduğu için bu
 * genişletme onun saflığını bozmadan iki dilli eşleşme sağlar.
 */
export function expandInventoryForMatching(
  items: readonly Pick<InventoryItem, 'name' | 'nameTr' | 'nameEn'>[]
): { name: string }[] {
  const expanded: { name: string }[] = [];
  for (const item of items) {
    const variants = new Set(
      [item.name, item.nameTr, item.nameEn].filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0
      )
    );
    for (const name of variants) {
      expanded.push({ name });
    }
  }
  return expanded;
}

/** Kiler adı çözümlemede kullanılan minimum alanlar (PantryItem alt kümesi). */
export interface PantryNameFields {
  name: string;
  nameTr?: string;
  nameEn?: string;
}

/**
 * Kiler malzemesinin verilen dildeki adı: varsayılan malzemeler statik i18n
 * etiketiyle ("Tuz" → "Salt", LLM YOK), kullanıcı eklemeleri iki dilli
 * alanlarıyla (nameTr/nameEn — asistan ekleme + backfill doldurur) çözülür;
 * karşılık yoksa kanonik ada düşer.
 */
export function pantryNameForLanguage(item: PantryNameFields, language: AppLanguage): string {
  const key = pantryItemKey(item.name);
  if (key !== item.name) {
    const translated = i18n.t(key, { lng: language });
    if (typeof translated === 'string' && translated.length > 0 && translated !== key) {
      return translated;
    }
  }
  return (language === 'tr' ? item.nameTr : item.nameEn) ?? item.name;
}

/**
 * Kiler chip'i/onay etiketi gösterim adı — AKTİF uygulama dilinde.
 * `t(pantryItemKey(name))` kalıbının yerini alır: anahtarı olmayan kullanıcı
 * eklemelerinde t() çağrısı yapılmaz (i18n "EKSİK ÇEVİRİ ANAHTARI" uyarısının
 * kaynağı buydu), iki dilli alan varsa o kullanılır.
 */
export function pantryDisplayName(item: PantryNameFields): string {
  return pantryNameForLanguage(item, getAppLanguage());
}

/**
 * Kiler adlarını üretim isteğine gidecek dile çevirir (Bulgu 1 düzeltmesi —
 * bkz. analysis/rag-analysis.md §7b): TR kiler adları İngilizce prompt'a
 * girince model "salt"ı kilerle eşleştiremiyor ve sahte eksik üretiyordu;
 * edge function'daki hibrit kısayol da aynı nedenle bloke oluyordu (canlı
 * ölçüm: 8 tarifte 12 sahte eksik → EN kilerle 2).
 */
export function pantryPromptNames(
  items: readonly PantryNameFields[],
  language: AppLanguage
): string[] {
  return items.map((item) => pantryNameForLanguage(item, language));
}

/**
 * Dil karşılığı eksik KULLANICI kiler malzemelerini tek toplu çeviriyle
 * tamamlar (envanterdeki backfillInventoryTranslations kalıbı). Varsayılan
 * malzemeler atlanır — çevirileri zaten i18n anahtarından gelir. Hata
 * durumunda sessizce vazgeçilir; gösterim/prompt kanonik ada düşmeye devam eder.
 */
export async function backfillPantryTranslations(targetLanguage: AppLanguage): Promise<void> {
  const { items, applyNameTranslations } = usePantryStore.getState();
  const targetField = targetLanguage === 'tr' ? 'nameTr' : 'nameEn';
  const missing = items.filter(
    (item) => pantryItemKey(item.name) === item.name && !item[targetField]
  );
  if (missing.length === 0) {
    return;
  }

  const translations = await translateTexts(
    missing.map((item) => item.name),
    toTranslationLanguage(targetLanguage)
  );
  applyNameTranslations(
    missing.map((item, index) => ({ id: item.id, [targetField]: translations[index] }))
  );
}

/**
 * computeMissing'in kiler parametresi için ad varyantlarını genişletir:
 * varsayılan kiler malzemelerinin (types/pantry.ts) çeviri anahtarları
 * bilindiği için her AKTİF malzeme TR + EN gösterim adlarıyla birlikte döner
 * ("Tuz" ↔ "Salt" — EN üretilmiş tarifte "salt" eksik sayılmasın).
 * Kullanıcının kendi eklediği (anahtarı olmayan) malzemeler adıyla kalır.
 */
export function expandPantryForMatching(
  pantryItems: readonly Pick<PantryItem, 'name' | 'nameTr' | 'nameEn' | 'active'>[]
): { name: string; active: boolean }[] {
  const expanded: { name: string; active: boolean }[] = [];
  for (const item of pantryItems) {
    if (!item.active) {
      continue;
    }
    const variants = new Set([item.name]);
    const key = pantryItemKey(item.name);
    if (key !== item.name) {
      for (const lng of ['tr', 'en'] as const) {
        const translated = i18n.t(key, { lng });
        if (typeof translated === 'string' && translated.length > 0 && translated !== key) {
          variants.add(translated);
        }
      }
    }
    // Kullanıcı eklemelerinin iki dilli alanları (asistan ekleme + backfill).
    for (const fieldName of [item.nameTr, item.nameEn]) {
      if (typeof fieldName === 'string' && fieldName.trim().length > 0) {
        variants.add(fieldName);
      }
    }
    for (const name of variants) {
      expanded.push({ name, active: true });
    }
  }
  return expanded;
}
