import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

import { CARD_IMAGE_HEIGHT } from './RecipeCard';

interface RecipeSkeletonCardProps {
  /**
   * Aşama 1 (isim/plan) döndüyse tarif adı biliniyor ama detay hâlâ
   * yükleniyor — bu durumda gri bar yerine gerçek adı gösteririz (MVP-15:
   * "isim biliniyor, detay yükleniyor" hissi). Verilmezse (Aşama 1 de henüz
   * dönmediyse) başlık da gri bar olarak kalır.
   */
  name?: string;
}

/**
 * Henüz detayı gelmemiş bir tarif için placeholder kart — yeni `RecipeCard`
 * ile BİREBİR aynı düzen (132px sabit foto bloğu, radius 20 + altında
 * 14.5px ad satırı, 2 sütunlu grid hücresini doldurur) kullanır ki gerçek
 * kart gelince layout zıplamasın. Spinner değil hafif opacity pulse.
 */
export default function RecipeSkeletonCard({ name }: RecipeSkeletonCardProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View className="w-full">
      <Animated.View
        style={{ opacity, height: CARD_IMAGE_HEIGHT }}
        className="w-full rounded-[20px] bg-sand"
      />
      {name ? (
        <Text className="mx-0.5 mt-2 font-sans-medium text-[14.5px] text-ink" numberOfLines={1}>
          {name}
        </Text>
      ) : (
        <Animated.View style={{ opacity }} className="mt-2.5 h-4 w-2/3 rounded-full bg-sand" />
      )}
    </View>
  );
}
