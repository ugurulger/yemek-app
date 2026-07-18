import { router, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { Card, Chip, PrimaryButton, SectionLabel } from '@/components/ui';
import { colors } from '@/lib/theme';
import { pantryCategoryKey, pantryItemKey } from '@/src/i18n/labels';
import { usePantryStore } from '@/store/pantryStore';
import { PANTRY_CATEGORIES, type PantryCategory, type PantryItem } from '@/types/pantry';

// Rota henüz typed-routes çıktısında olmayabilir (capture ekranları paralel
// geliştiriliyor) — Href'e cast edilir, rota adı spec §2/§3 ile sabit.
const PANTRY_ASSISTANT_ROUTE = '/capture/assistant?mode=pantry' as Href;

/**
 * Temel Malzemeler bloğu (spec §2, görsel: design/02-mutfagim-temel-malzemeler.png).
 * Serif başlık + kompakt "✦ Asistanla ekle" butonu; altında muted yönlendirme
 * satırı; sonra her kiler kategorisi için beyaz Card içinde seçilebilir
 * kompakt Chip'ler (aktif = evde var, dokununca toggle). Kartlar 2 sütun.
 */
export function PantrySection() {
  const { t } = useTranslation();
  const items = usePantryStore((state) => state.items);
  const toggleItem = usePantryStore((state) => state.toggleItem);

  const byCategory = new Map<PantryCategory, PantryItem[]>();
  for (const item of items) {
    const bucket = byCategory.get(item.category) ?? [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }
  const categories = PANTRY_CATEGORIES.filter((category) => byCategory.has(category));

  return (
    // Birebir referans (Mutfagim.dc.html satır 99-121): başlık satırı
    // margin 24 üst 10 alt (ipucu satırının -2px üst marginiyle net 8px
    // boşluk); başlık Newsreader 500 20px #23302B; sağda pill buton
    // (600 11.5px, 8×13, radius 20, ✦ 11px); ipucu 400 11.5px #8A9088
    // lh 1.35, ev ikonu 13, gap 6, alt margin 12; grid gap 9.
    <View className="mt-6">
      <View className="flex-row items-center justify-between">
        <Text className="font-serif text-[20px] text-ink">{t('pantry.title')}</Text>
        <PrimaryButton
          size="pill"
          label={t('inventory.addWithAssistant')}
          icon={<Text className="text-[11px] text-white">✦</Text>}
          onPress={() => router.push(PANTRY_ASSISTANT_ROUTE)}
        />
      </View>

      {/* mb-[3px] + satırların mt-[9px]'i = referanstaki 12px alt margin. */}
      <View className="mb-[3px] mt-2 flex-row items-center">
        <Ionicons name="home-outline" size={13} color={colors.muted} />
        <Text
          className="ml-1.5 flex-1 font-sans text-[11.5px] text-muted"
          style={{ lineHeight: 15.5 }}>
          {t('pantry.hint')}
        </Text>
      </View>

      {chunkPairs(categories).map(([left, right]) => (
        <View key={left} className="mt-[9px] flex-row gap-[9px]">
          <View className="flex-1">
            <PantryCategoryCard
              category={left}
              items={byCategory.get(left)!}
              onToggle={toggleItem}
            />
          </View>
          {right ? (
            <View className="flex-1">
              <PantryCategoryCard
                category={right}
                items={byCategory.get(right)!}
                onToggle={toggleItem}
              />
            </View>
          ) : (
            <View className="flex-1" />
          )}
        </View>
      ))}
    </View>
  );
}

function PantryCategoryCard({
  category,
  items,
  onToggle,
}: {
  category: PantryCategory;
  items: PantryItem[];
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    // Birebir referans (satır 112-118): radius 16 (Card varsayılanı 18 —
    // style prop'u ile ezilir), padding 11/11/8, kategori etiketi 600 10px
    // #96A199 (SectionLabel sm muted verir, text-muted2 ile override)
    // mb 8, chip'ler wrap gap 6.
    //
    // DİKKAT: `flex-1` KULLANILMAZ — flex-basis:0 native Yoga'da otomatik
    // yükseklikli sütunda kartı 0 yüksekliğe çökertip üst üste bindiriyordu
    // (web'de görünmeyen fark; cihaz ekran görüntüsüyle yakalandı). `grow`
    // (basis:auto) doğal ölçüm + satırdaki uzun kartla eşit yükseklik verir.
    <Card className="grow px-[11px] pb-2 pt-[11px]" style={{ borderRadius: 16 }}>
      <SectionLabel size="sm" className="text-muted2">
        {t(pantryCategoryKey(category))}
      </SectionLabel>
      <View className="mt-2 flex-row flex-wrap gap-1.5">
        {items.map((item) => (
          <Chip
            key={item.id}
            label={t(pantryItemKey(item.name))}
            selected={item.active}
            onPress={() => onToggle(item.id)}
            size="compact"
          />
        ))}
      </View>
    </Card>
  );
}

/** Kategorileri ikişerli satırlara böler; tek sayıda son hücre boş kalır. */
function chunkPairs<T>(items: T[]): [T, T | undefined][] {
  const pairs: [T, T | undefined][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push([items[i], items[i + 1]]);
  }
  return pairs;
}
