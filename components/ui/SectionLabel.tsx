import { Text } from 'react-native';

export interface SectionLabelProps {
  children: string;
  className?: string;
  /**
   * Referansta iki boy var: 'md' = tercih ekranı kategori başlığı
   * (600 11px, ls .6), 'sm' = kiler/market kategori başlığı (600 10px, ls .5).
   */
  size?: 'md' | 'sm';
}

/** UPPERCASE kategori etiketi — birebir referans (Mutfagim.dc.html). */
export function SectionLabel({ children, className = '', size = 'md' }: SectionLabelProps) {
  return (
    <Text
      className={`font-sans-semibold uppercase text-muted ${
        size === 'sm' ? 'text-[10px]' : 'text-[11px]'
      } ${className}`}
      style={{ letterSpacing: size === 'sm' ? 0.5 : 0.6 }}>
      {children}
    </Text>
  );
}
