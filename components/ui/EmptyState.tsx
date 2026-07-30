import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { cardShadow } from '@/lib/theme';
import { PrimaryButton } from './PrimaryButton';

export interface EmptyStateProps {
  /** Büyük görsel öğe — emoji metni ("🧺") veya hazır bir ikon node'u. */
  emoji?: string;
  icon?: ReactNode;
  title: string;
  body: string;
  /** CTA verilirse altta primary buton çizilir (boş durum kuralı: net eylem). */
  ctaLabel?: string;
  onPressCta?: () => void;
  /** true → beyaz kart zemininde (liste içi); false → çıplak ortalanmış blok. */
  card?: boolean;
  className?: string;
}

/**
 * Ortak boş durum bloğu (tasarım kuralı: asla sadece "liste boş" yazılmaz) —
 * sıcak başlık + tek cümle yönlendirme + net CTA. Tüm sekmelerin boş
 * durumları bu bileşenden geçer ki ton ve yerleşim tutarlı kalsın.
 */
export function EmptyState({
  emoji,
  icon,
  title,
  body,
  ctaLabel,
  onPressCta,
  card = true,
  className = '',
}: EmptyStateProps) {
  const content = (
    <>
      {icon ? (
        <View className="h-16 w-16 items-center justify-center rounded-full bg-cream">{icon}</View>
      ) : emoji ? (
        <Text className="text-5xl">{emoji}</Text>
      ) : null}
      <Text className="mt-4 text-center font-serif text-[22px] text-ink">{title}</Text>
      <Text className="mt-2 text-center font-sans text-[13px] leading-[19px] text-muted">
        {body}
      </Text>
      {ctaLabel && onPressCta ? (
        <View className="mt-5 self-stretch">
          <PrimaryButton label={ctaLabel} size="cta" onPress={onPressCta} />
        </View>
      ) : null}
    </>
  );

  if (card) {
    return (
      <View className={`items-center rounded-2xl bg-white px-6 py-8 ${className}`} style={cardShadow}>
        {content}
      </View>
    );
  }
  return <View className={`items-center px-6 ${className}`}>{content}</View>;
}
