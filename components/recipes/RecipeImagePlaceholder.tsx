import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

interface RecipeImagePlaceholderProps {
  emoji: string;
  /** Kutu sınıfları — görselle BİREBİR aynı boyut verilmeli ki kart zıplamasın. */
  boxClassName: string;
  emojiSize: number;
  /** Görsel üretimi sürerken hafif opacity pulse'ı oynatılır (spinner yok). */
  pulsing: boolean;
}

/**
 * Görsel henüz üretilmemişken/başarısızken gösterilen emoji'li placeholder.
 * Emerald-50 zemin, ortada büyük emoji; görselle aynı boyutta olduğu için
 * görsel geldiğinde layout kaymaz.
 */
export default function RecipeImagePlaceholder({
  emoji,
  boxClassName,
  emojiSize,
  pulsing,
}: RecipeImagePlaceholderProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulsing) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulsing, opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <View className={`items-center justify-center bg-emerald-50 ${boxClassName}`}>
        <Text style={{ fontSize: emojiSize }}>{emoji}</Text>
      </View>
    </Animated.View>
  );
}
