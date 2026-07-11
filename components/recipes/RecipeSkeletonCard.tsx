import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

interface RecipeSkeletonCardProps {
  /**
   * Aşama 1 (isim/plan) döndüyse tarif adı biliniyor ama detay hâlâ
   * yükleniyor — bu durumda gri bar yerine gerçek adı gösteririz (MVP-15:
   * "isim biliniyor, detay yükleniyor" hissi). Verilmezse (Aşama 1 de henüz
   * dönmediyse) başlık de gri bar olarak kalır.
   */
  name?: string;
}

/**
 * Henüz detayı gelmemiş bir tarif için placeholder kart — `RecipeCard` ile
 * BİREBİR aynı boyut/layout (80px görsel kutusu + metin satırları) kullanır ki
 * gerçek kart gelince layout zıplamasın. Spinner değil hafif opacity pulse.
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
    <View className="flex-row items-center rounded-2xl bg-white p-3 ring-1 ring-stone-100 shadow-sm">
      <Animated.View style={{ opacity }} className="mr-3 h-20 w-20 rounded-xl bg-stone-100" />
      <View className="flex-1">
        {name ? (
          <Text
            style={{ fontFamily: 'Fraunces_600SemiBold' }}
            className="text-base text-stone-900"
            numberOfLines={1}
          >
            {name}
          </Text>
        ) : (
          <Animated.View style={{ opacity }} className="h-4 w-2/3 rounded-full bg-stone-100" />
        )}
        <Animated.View style={{ opacity }} className="mt-3 flex-row">
          <View className="mr-2 h-5 w-16 rounded-full bg-stone-100" />
          <View className="mr-2 h-5 w-20 rounded-full bg-stone-100" />
          <View className="h-5 w-14 rounded-full bg-stone-100" />
        </Animated.View>
      </View>
    </View>
  );
}
