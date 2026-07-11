import { Image, Pressable, Text, View } from 'react-native';

import { useRecipeImage } from '@/services/images/useRecipeImage';
import type { Cookbook } from '@/types/cookbook';
import type { Recipe } from '@/types/recipe';

/** Kolaj kapağın zemini — birebir referans (Mutfagim.dc.html 445): #EBE7DE. */
const COVER_BG = '#EBE7DE';
/** Tarifi/görseli olmayan tile — zeminden hafif ton farklı krem düz zemin. */
const EMPTY_TILE_BG = '#F3EEDF';

/** Kapak gölgesi — referans 445: 0 4px 14px -6px rgba(31,74,61,.22). */
const COVER_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.22,
  shadowRadius: 7,
  elevation: 3,
} as const;

interface CookbookCardProps {
  cookbook: Cookbook;
  /** Defterin ÇÖZÜLMÜŞ tarifleri (bulunamayan id'ler atlanmış) — ilk 3'ü kolajda kullanılır. */
  recipes: Recipe[];
  onPress: () => void;
}

/** Kolaj hücresi — tarif yoksa krem düz zemin (hook'suz dal). */
function CollageTile({ recipe }: { recipe?: Recipe }) {
  if (!recipe) {
    return <View className="flex-1" style={{ backgroundColor: EMPTY_TILE_BG }} />;
  }
  return <CollageRecipeTile recipe={recipe} />;
}

/** Tarifli kolaj hücresi — thumbnail hazır değilse yine krem zeminde bekler. */
function CollageRecipeTile({ recipe }: { recipe: Recipe }) {
  const { uri } = useRecipeImage(recipe, 'thumbnail');
  return (
    <View className="flex-1" style={{ backgroundColor: EMPTY_TILE_BG }}>
      {uri ? (
        <Image
          source={{ uri }}
          className="h-full w-full"
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

/**
 * Defter kartı — birebir referans (SCREEN 5, satır 443-452): 150px kolaj
 * kapak (CSS grid'in RN karşılığı: solda TEK büyük tile, sağda üst üste 2
 * küçük tile, 3px aralık), altında defter adı (600 15 ink) + "{N} tarif"
 * (400 12 muted). Kapak, defterin ilk 3 tarifinin thumbnail'ını gösterir.
 */
export function CookbookCard({ cookbook, recipes, onPress }: CookbookCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cookbook.name} defterini aç`}
      onPress={onPress}
      className="active:scale-95">
      <View
        className="flex-row overflow-hidden rounded-[18px]"
        style={[{ height: 150, backgroundColor: COVER_BG }, COVER_SHADOW]}>
        {/* Sol yarı: tam yükseklik tek büyük tile */}
        <CollageTile recipe={recipes[0]} />
        {/* Sağ yarı: üst üste iki küçük tile (aralarında 3px) */}
        <View className="ml-[3px] flex-1">
          <CollageTile recipe={recipes[1]} />
          <View className="h-[3px]" />
          <CollageTile recipe={recipes[2]} />
        </View>
      </View>
      <Text className="mx-[2px] mt-[9px] font-sans-semibold text-[15px] text-ink" numberOfLines={1}>
        {cookbook.name}
      </Text>
      <Text className="mx-[2px] mt-[1px] font-sans text-[12px] text-muted">
        {recipes.length} tarif
      </Text>
    </Pressable>
  );
}
