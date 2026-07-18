/**
 * Market Sepeti — spec §6, görsel `11-market-sepeti.png`.
 *
 * Model: sepette HAM kayıt tarif+malzeme bazında tutulur (`CartEntry`) —
 * böylece bir tarifin kişi sayısı değişince o tarifin katkısı yeniden
 * yazılabilir, tarif sepetten çıkarılabilir. Görüntüleme ise malzeme bazında
 * BİRLEŞTİRİLMİŞ satırlardır (`CartItemView`): aynı malzeme birden çok
 * tariften geliyorsa miktarlar toplanır, kaynak tarifler etikette gösterilir.
 */
import type { IngredientCategory } from './recipe';

export interface CartEntry {
  id: string;
  /**
   * Jenerik malzeme adı (tarif malzemesinden gelir) — KANONİK anahtar
   * (birleştirme/işaretleme bu ada göre), tarifin ÜRETİLDİĞİ dildedir.
   */
  name: string;
  /**
   * İki dilli gösterim adları (İş 3c): kayıt dile bağlı tek string'e
   * kilitlenmesin diye, ad biliniyorsa her iki dilde taşınır (kaynak: tarifin
   * orijinali + mevcut tarif çevirisi — ekstra çeviri çağrısı YAPILMAZ).
   * Render aktif dile göre seçer, karşılık yoksa `name`e düşer.
   */
  nameTr?: string;
  nameEn?: string;
  qty: number;
  unit: string;
  category: IngredientCategory;
  /** Bu katkının geldiği tarifin adı — birleşik satırda etiket olarak görünür. */
  recipeName: string;
}

/** Birleştirilmiş görünüm satırı — market ekranı bunu render eder. */
export interface CartItemView {
  /** normalize(ad)+birim — işaretleme durumu bu anahtarla saklanır. */
  key: string;
  name: string;
  /** Bkz. CartEntry.nameTr/nameEn — birleşik satırda ilk bilinen karşılıklar. */
  nameTr?: string;
  nameEn?: string;
  qty: number;
  unit: string;
  category: IngredientCategory;
  /** Kaynak tarif adları (tekilleştirilmiş, giriş sırasına göre). */
  recipeNames: string[];
  checked: boolean;
}
