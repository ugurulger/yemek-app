import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

import InventoryList from '@/components/inventory/InventoryList';
import { extractInventory, getVisionProvider, InventoryVisionError } from '@/services/vision';
import { extractVideoFramesAsBase64 } from '@/lib/media/extractVideoFrames';
import { resizeImageToBase64 } from '@/lib/media/resizeImageToBase64';
import { useInventoryStore } from '@/store/inventoryStore';
import type { InventoryCategory, InventoryItem } from '@/types/inventory';

// Bu skorun altındaki ürünler kategorili listede YER KAPLAMAZ — bunun yerine
// listenin altında tek satırlık bir özet gösterilir, tıklanınca bir modalde
// tam kart olarak gösterilirler (bkz. services/vision/prompt.ts —
// match_confidence). MVP-8'de 50 → 90'a çıkarıldı: kullanıcı belirsiz
// ürünlerin ana listede yer kaplamasını istemedi, eşik yükseltilerek daha
// az ürün "kesin" sayılıyor.
const CONFIDENCE_THRESHOLD = 90;

// MVP-10 (Bölüm B — UI redesign): ham 7 kategori (services/vision/prompt.ts
// — VIDEO_TABLE_PROMPT) görüntülemede 5 üst gruba birleştirilir — sadece
// GÖRÜNTÜLEME gruplaması, yeni bir API çağrısı/şema değişikliği gerekmez,
// ham `item.category` aynen saklanır.
type CategoryGroup = 'Süt & Peynir' | 'Et & Şarküteri' | 'Meyve & Sebze' | 'İçecek & Sos' | 'Diğer';

const CATEGORY_GROUPS: Record<InventoryCategory, CategoryGroup> = {
  'Süt Ürünleri': 'Süt & Peynir',
  Peynir: 'Süt & Peynir',
  Şarküteri: 'Et & Şarküteri',
  İçecek: 'İçecek & Sos',
  'Sos & Baharat': 'İçecek & Sos',
  'Meyve & Sebze': 'Meyve & Sebze',
  Diğer: 'Diğer',
};

const GROUP_ORDER: CategoryGroup[] = [
  'Süt & Peynir',
  'Et & Şarküteri',
  'Meyve & Sebze',
  'İçecek & Sos',
  'Diğer',
];

const GROUP_LABELS: Record<CategoryGroup, string> = {
  'Süt & Peynir': '🥛 Süt & Peynir',
  'Et & Şarküteri': '🍖 Et & Şarküteri',
  'Meyve & Sebze': '🥦 Meyve & Sebze',
  'İçecek & Sos': '🥤 İçecek & Sos',
  Diğer: '🗂️ Diğer',
};

// Kart başına tabak/çatal ikonu yerine kullanılan sol renkli şerit — tasarım
// sistemindeki emerald-900/amber-500 paletinin ton varyasyonları (bkz.
// SKILL.md "Tasarım sistemi"), yeni bir renk ailesi İCAT EDİLMEDİ.
const GROUP_STRIPE_COLORS: Record<CategoryGroup, string> = {
  'Süt & Peynir': '#064e3b', // emerald-900
  'Et & Şarküteri': '#f59e0b', // amber-500
  'Meyve & Sebze': '#10b981', // emerald-500
  'İçecek & Sos': '#fcd34d', // amber-300
  Diğer: '#d6d3d1', // stone-300
};

function groupItemsByCategoryGroup(
  items: InventoryItem[]
): Array<{ group: CategoryGroup; items: InventoryItem[] }> {
  const buckets = new Map<CategoryGroup, InventoryItem[]>();
  for (const item of items) {
    // İki aşamalı JSON akışının şeması "category" üretmez — kategorisiz
    // ürünler "Diğer" altında toplanır (bkz. types/inventory.ts).
    const rawCategory = item.category ?? 'Diğer';
    const group = CATEGORY_GROUPS[rawCategory] ?? 'Diğer';
    const bucket = buckets.get(group) ?? [];
    bucket.push(item);
    buckets.set(group, bucket);
  }
  return GROUP_ORDER.filter((group) => buckets.has(group)).map((group) => ({
    group,
    items: buckets.get(group)!,
  }));
}

// MVP-10 (Bölüm B): ana kategorili listenin kart görünümü — tabak/çatal
// ikonu YOK (yerine sol renkli şerit), confidence rozeti YOK (bu liste zaten
// CONFIDENCE_THRESHOLD'un üzerindeki ürünleri gösterir, bkz. yukarıda).
// `components/inventory/InventoryRow.tsx` bu görev kapsamı dışında
// tutulduğu (SADECE index.tsx'in render/stil katmanı) için kart burada
// YEREL olarak tanımlanır — "emin olunamayan ürünler" modalı hâlâ mevcut
// `InventoryList`/`InventoryRow`'u (ikon + confidence rozetiyle) kullanır,
// bilinçli olarak DEĞİŞTİRİLMEDİ.
function ProductCard({
  item,
  stripeColor,
  onIncrement,
  onDecrement,
  onDelete,
}: {
  item: InventoryItem;
  stripeColor: string;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isAtMin = item.qty <= 1;
  const formattedQty = Number.isInteger(item.qty) ? item.qty.toString() : item.qty.toFixed(1);

  return (
    <View className="flex-row items-center py-3">
      <View className="mr-3 h-10 w-1.5 rounded-full" style={{ backgroundColor: stripeColor }} />
      <View className="flex-1">
        <Text className="text-base text-stone-900" style={{ fontFamily: 'Outfit_600SemiBold' }}>
          {item.name}
        </Text>
        {item.brand && (
          <Text className="text-xs text-stone-400" style={{ fontFamily: 'Outfit_400Regular' }}>
            {item.brand}
          </Text>
        )}
        <Text className="mt-0.5 text-sm text-stone-500" style={{ fontFamily: 'Outfit_400Regular' }}>
          {formattedQty} {item.unit}
          {item.location ? ` · ${item.location}` : ''}
        </Text>
      </View>
      <View className="flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name} miktarını azalt`}
          disabled={isAtMin}
          onPress={() => onDecrement(item.id)}
          className={`h-8 w-8 items-center justify-center rounded-full bg-emerald-900 active:scale-95 ${
            isAtMin ? 'opacity-50' : ''
          }`}>
          <Ionicons name="remove" size={16} color="white" />
        </Pressable>
        <Text
          className="mx-2 min-w-[20px] text-center text-sm text-stone-900"
          style={{ fontFamily: 'Outfit_500Medium' }}>
          {formattedQty}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name} miktarını artır`}
          onPress={() => onIncrement(item.id)}
          className="h-8 w-8 items-center justify-center rounded-full bg-emerald-900 active:scale-95">
          <Ionicons name="add" size={16} color="white" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name} ürününü sil`}
          onPress={() => onDelete(item.id)}
          className="ml-3 h-8 w-8 items-center justify-center rounded-full active:scale-95">
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </Pressable>
      </View>
    </View>
  );
}

export default function MutfagimScreen() {
  const items = useInventoryStore((state) => state.items);
  const addItems = useInventoryStore((state) => state.addItems);
  const incrementQty = useInventoryStore((state) => state.incrementQty);
  const decrementQty = useInventoryStore((state) => state.decrementQty);
  const removeItem = useInventoryStore((state) => state.removeItem);
  const confirmItem = useInventoryStore((state) => state.confirmItem);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // DEBUG — kaldırılacak: Aşama 1 (gözlem) ham metnini görüntülemek için.
  const [observationText, setObservationText] = useState<string | null>(null);
  const [isObservationModalVisible, setIsObservationModalVisible] = useState(false);
  const [isUncertainModalVisible, setIsUncertainModalVisible] = useState(false);

  async function handlePickAndAnalyze() {
    setErrorMessage(null);
    setObservationText(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage('Galeriye erişim izni gerekli.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    setIsAnalyzing(true);
    // MVP-9 (performans): video seçiminden envanterin ekrana gelmesine kadar
    // geçen süreyi aşamalara ayırıp loglamak için — bkz. SKILL.md "Performans
    // notları". Ağ isteği + parse süreleri services/vision/gemini-provider.ts
    // içinde ayrıca loglanıyor (bkz. `logStage`).
    const tPickStart = performance.now();

    try {
      let extractedItems;
      const videoProvider = getVisionProvider();

      if (asset.type === 'video' && videoProvider.extractInventoryFromVideo) {
        // MVP-7: sağlayıcı native-video akışını destekliyorsa (şu an sadece
        // Gemini) kare çıkarma TAMAMEN atlanır, ham video tek çağrıda
        // gönderilir (bkz. services/vision/gemini-provider.ts).
        // MVP-9 (performans): video burada ARTIK base64'e çevrilmiyor —
        // `File` zaten bir `Blob`, sağlayıcıya doğrudan geçiriliyor. Büyük
        // videolar (Files API eşiğinin üstü) blob olarak yüklenir, base64
        // dönüşümü sadece küçük/inline videolar için sağlayıcı içinde
        // gerektiğinde yapılır (bkz. gemini-provider.ts — çift base64
        // dönüşümü bulgusu, SKILL.md "Performans notları").
        const videoFile = new File(asset.uri);
        console.log(
          `[perf] video seçiminden isteğe (dosya hazırlama): ${(performance.now() - tPickStart).toFixed(0)}ms`
        );
        extractedItems = await videoProvider.extractInventoryFromVideo(
          { file: videoFile, mimeType: 'video/mp4' },
          { onObservation: setObservationText }
        );
      } else if (asset.type === 'video') {
        // Geriye dönük uyumluluk: sağlayıcı native-video desteklemiyorsa
        // (örn. Claude seçiliyse) eski kare-tabanlı akış kullanılır.
        const frames = await extractVideoFramesAsBase64(asset.uri);
        if (frames.length === 0) {
          throw new InventoryVisionError('Video işlenemedi, tekrar deneyin.');
        }
        extractedItems = await extractInventory(frames, { onObservation: setObservationText });
      } else {
        // Fotoğrafı Claude vision'a göndermeden önce boyutlandır: tam çözünürlüklü
        // telefon fotoğrafları API limitlerini zorlar, yavaş ve pahalıdır.
        const image = await resizeImageToBase64(asset.uri, asset.width, asset.height);
        extractedItems = await extractInventory([image], { onObservation: setObservationText });
      }

      const tBeforeAddItems = performance.now();
      addItems(extractedItems);
      console.log(
        `[perf] state güncelleme (addItems): ${(performance.now() - tBeforeAddItems).toFixed(0)}ms`
      );
      console.log(
        `[perf] TOPLAM (seçimden envanterin state'e yazılmasına): ${(performance.now() - tPickStart).toFixed(0)}ms`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bir şeyler ters gitti, tekrar deneyin.';
      setErrorMessage(message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const hasItems = items.length > 0;
  const normalItems = items.filter(
    (item) => item.confidence === undefined || item.confidence >= CONFIDENCE_THRESHOLD
  );
  const uncertainItems = items.filter(
    (item) => item.confidence !== undefined && item.confidence < CONFIDENCE_THRESHOLD
  );
  const categorizedSections = groupItemsByCategoryGroup(normalItems);

  return (
    <SafeAreaView className="flex-1 bg-stone-50" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Text className="text-3xl text-emerald-900" style={{ fontFamily: 'Fraunces_700Bold' }}>
          Mutfağım
        </Text>
        {hasItems && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fotoğraf veya video ekle"
            onPress={handlePickAndAnalyze}
            disabled={isAnalyzing}
            className="h-11 w-11 items-center justify-center rounded-full bg-emerald-900 active:scale-95">
            {isAnalyzing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="add" size={24} color="white" />
            )}
          </Pressable>
        )}
      </View>

      {isAnalyzing && (
        <View className="mx-5 mb-2 flex-row items-center rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-100">
          <ActivityIndicator color="#064e3b" size="small" />
          <Text
            className="ml-3 text-sm text-stone-700"
            style={{ fontFamily: 'Outfit_400Regular' }}>
            Buzdolabı analiz ediliyor…
          </Text>
        </View>
      )}

      {errorMessage && (
        <View className="mx-5 mb-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-100">
          <Text className="text-sm text-red-500" style={{ fontFamily: 'Outfit_500Medium' }}>
            {errorMessage}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={handlePickAndAnalyze}
            className="mt-2 self-start active:scale-95">
            <Text className="text-sm text-emerald-900" style={{ fontFamily: 'Outfit_500Medium' }}>
              Tekrar dene
            </Text>
          </Pressable>
        </View>
      )}

      {/* DEBUG — kaldırılacak: Aşama 1 (gözlem) ham metnini görüntüleme butonu. */}
      {observationText && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsObservationModalVisible(true)}
          className="mx-5 mb-2 self-start active:scale-95">
          <Text className="text-xs text-stone-400" style={{ fontFamily: 'Outfit_500Medium' }}>
            [DEBUG] Ham Metni Gör
          </Text>
        </Pressable>
      )}

      {hasItems ? (
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}>
          {/* MVP-10 (Bölüm B): "emin olunamayan ürünler" bildirimi artık
              amber vurgu rengiyle, ayrı bir uyarı kartı olarak — mevcut
              kategori kartlarından görsel olarak ayrışsın diye "Buzdolabım"
              dış kartının DIŞINDA, en üstte duruyor. */}
          {uncertainItems.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Emin olunamayan ürünleri gözden geçir"
              onPress={() => setIsUncertainModalVisible(true)}
              className="mb-4 flex-row items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200 active:scale-95">
              <Text
                className="flex-1 text-sm text-amber-900"
                style={{ fontFamily: 'Outfit_600SemiBold' }}>
                ⚠️ {uncertainItems.length} ürün kontrol bekliyor
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#b45309" />
            </Pressable>
          )}

          {/* MVP-10 (Bölüm B): tüm kategoriler TEK bir "Buzdolabım" dış
              kartı içinde, aralarında ince ayraçlarla ayrılan iç bölümler
              olarak — "dolap ve rafları" hissi. */}
          <View className="mb-4 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-stone-200">
            <Text
              className="mb-1 text-base text-stone-500"
              style={{ fontFamily: 'Outfit_500Medium' }}>
              🧊 Buzdolabım
            </Text>
            {categorizedSections.map(({ group, items: groupItems }, sectionIndex) => (
              <View
                key={group}
                className={sectionIndex > 0 ? 'mt-4 border-t border-stone-100 pt-4' : 'mt-2'}>
                <View className="mb-1 self-start rounded-full bg-stone-100 px-3 py-1">
                  <Text
                    className="text-sm text-stone-900"
                    style={{ fontFamily: 'Outfit_600SemiBold' }}>
                    {GROUP_LABELS[group]}
                  </Text>
                </View>
                {groupItems.map((item, itemIndex) => (
                  <View key={item.id} className={itemIndex > 0 ? 'border-t border-stone-50' : ''}>
                    <ProductCard
                      item={item}
                      stripeColor={GROUP_STRIPE_COLORS[group]}
                      onIncrement={incrementQty}
                      onDecrement={decrementQty}
                      onDelete={removeItem}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-full items-center rounded-2xl bg-white p-8 shadow-sm ring-1 ring-stone-100">
            <Text className="text-5xl">🧺</Text>
            <Text
              className="mt-4 text-center text-lg text-stone-900"
              style={{ fontFamily: 'Fraunces_600SemiBold' }}>
              Envanterin henüz boş
            </Text>
            <Text
              className="mt-2 text-center text-sm text-stone-500"
              style={{ fontFamily: 'Outfit_400Regular' }}>
              Fiş fotoğrafı ya da buzdolabı videosu yükleyerek envanterine başla.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fotoğraf veya video ekle"
              onPress={handlePickAndAnalyze}
              disabled={isAnalyzing}
              className="mt-5 flex-row items-center rounded-2xl bg-emerald-900 px-5 py-3 active:scale-95">
              <Ionicons name="camera-outline" size={18} color="white" />
              <Text
                className="ml-2 text-sm text-white"
                style={{ fontFamily: 'Outfit_500Medium' }}>
                Fotoğraf veya video ekle
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Confidence < CONFIDENCE_THRESHOLD ürünler burada tam kart olarak
          gösterilir (mevcut "Envantere ekle" akışıyla) — ana kategorili
          listede yer kaplamazlar, bkz. yukarıdaki özet satırı. */}
      <Modal
        visible={isUncertainModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsUncertainModalVisible(false)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
            <Text className="text-lg text-stone-900" style={{ fontFamily: 'Fraunces_600SemiBold' }}>
              Emin olunamayan ürünler
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsUncertainModalVisible(false)}
              className="active:scale-95">
              <Ionicons name="close" size={24} color="#1c1917" />
            </Pressable>
          </View>
          <View className="flex-1 px-5">
            <InventoryList
              items={uncertainItems}
              onIncrement={incrementQty}
              onDecrement={decrementQty}
              onDelete={removeItem}
              onConfirm={confirmItem}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* DEBUG — kaldırılacak: Aşama 1 (gözlem) ham metni modalı. */}
      <Modal
        visible={isObservationModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsObservationModalVisible(false)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
            <Text className="text-lg text-stone-900" style={{ fontFamily: 'Fraunces_600SemiBold' }}>
              [DEBUG] Aşama 1 — Ham Gözlem Metni
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsObservationModalVisible(false)}
              className="active:scale-95">
              <Ionicons name="close" size={24} color="#1c1917" />
            </Pressable>
          </View>
          <ScrollView className="flex-1 px-5 py-2">
            <Text className="text-sm text-stone-700" style={{ fontFamily: 'Outfit_400Regular' }}>
              {observationText}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
