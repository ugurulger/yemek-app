import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

/**
 * Blok "son güncelleme" etiketi (İş 2) — Buzdolabım ve Temel Malzemeler blok
 * başlıklarının altında düşük görsel ağırlıklı küçük metin. Bugünse "Bugün",
 * dünse "Dün", daha eskiyse aktif uygulama diline göre Intl ile formatlanmış
 * tarih (yıl yalnızca içinde bulunulan yıldan farklıysa gösterilir).
 * Zaman damgası yoksa (hiç değişiklik yapılmamış) hiçbir şey çizmez.
 */
export function LastUpdatedLabel({
  timestamp,
  className,
}: {
  timestamp: number | null;
  /** Konum ayarı (margin vb.) çağıran taraftan — stil bloğun kendisinde sabit. */
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  if (!timestamp) return null;

  const date = new Date(timestamp);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  let dateLabel: string;
  if (dayDiff <= 0) {
    dateLabel = t('common.today');
  } else if (dayDiff === 1) {
    dateLabel = t('common.yesterday');
  } else {
    const locale = i18n.language === 'tr' ? 'tr-TR' : 'en-US';
    dateLabel = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    }).format(date);
  }

  return (
    <Text className={`font-sans text-[10.5px] text-muted2 ${className ?? ''}`}>
      {t('inventory.lastUpdated', { date: dateLabel })}
    </Text>
  );
}
