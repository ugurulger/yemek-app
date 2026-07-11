import { ReactNode } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';

import { cardShadow } from '../../lib/theme';

export interface CardProps {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Beyaz zemin, radius 18, yumuşak gölge
 * (0 2px 10px -4px rgba(31,74,61,.12) yaklaşımı).
 */
export function Card({ children, className = '', style }: CardProps) {
  return (
    <View className={`bg-white rounded-[18px] ${className}`} style={[cardShadow, style]}>
      {children}
    </View>
  );
}
