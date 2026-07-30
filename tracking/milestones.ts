/**
 * "İlk kez" bayrakları (is_first property'leri + $set_once milestone'ları
 * için) — AsyncStorage'da tek JSON blob, açılışta senkron cache'e yüklenir.
 *
 * Event çağrıları senkron olduğu için claim() senkron çalışır; kalıcılaştırma
 * arka planda yapılır (fire-and-forget). Cache henüz yüklenmediyse güvenli
 * varsayılan "ilk değil"dir — yanlış is_first=true üretmektense atlanır
 * (init app açılışında ilk iş olarak koşar, pratikte yarış görülmez).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@yemek-app/tracking-milestones';

export type MilestoneKey =
  | 'app_opened'
  | 'capture_started'
  | 'capture_completed'
  | 'generation_started'
  | 'generation_completed'
  | 'recipe_added'
  | 'plan_entry'
  | 'market_use';

let cache: Partial<Record<MilestoneKey, string>> | null = null;

export async function initMilestones(): Promise<void> {
  if (cache !== null) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as Partial<Record<MilestoneKey, string>>) : {};
  } catch {
    cache = {};
  }
}

/**
 * Bu milestone daha önce hiç yaşanmadıysa true döner ve anı işaretler
 * (ISO timestamp). İkinci ve sonraki çağrılar false döner.
 */
export function claimFirst(key: MilestoneKey): boolean {
  if (cache === null) return false; // init bitmeden güvenli varsayılan
  if (cache[key]) return false;
  cache[key] = new Date().toISOString();
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => {});
  return true;
}

/** Milestone'un işaretlendiği an (yoksa undefined) — $set_once değerleri için. */
export function milestoneAt(key: MilestoneKey): string | undefined {
  return cache?.[key];
}
