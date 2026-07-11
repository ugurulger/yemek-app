import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
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

// MVP-10 (Bölüm B — UI redesign): ham 7 kategori (types/inventory.ts —
// INVENTORY_CATEGORIES, video akışının responseSchema'sı dayatır)
// görüntülemede 5 üst gruba birleştirilir — sadece GÖRÜNTÜLEME gruplaması,
// yeni bir API çağrısı/şema değişikliği gerekmez, ham `item.category` aynen
// saklanır.
type CategoryGroup = 'Süt & Peynir' | 'Et & Şarküteri' | 'Meyve & Sebze' | 'Sos & Baharat' | 'Diğer';

// MVP-17: içecekler artık envantere alınmıyor (video akışında prompt kuralı +
// parse filtresi, bkz. services/vision/prompt.ts) — "İçecek & Sos" grubu
// "Sos & Baharat" oldu. 'İçecek' anahtarı tip gereği kalıyor; store'da kalmış
// eski içecek kayıtları için "Diğer"e düşen bir geri-dönüş.
const CATEGORY_GROUPS: Record<InventoryCategory, CategoryGroup> = {
  'Süt Ürünleri': 'Süt & Peynir',
  Peynir: 'Süt & Peynir',
  Şarküteri: 'Et & Şarküteri',
  İçecek: 'Diğer',
  'Sos & Baharat': 'Sos & Baharat',
  'Meyve & Sebze': 'Meyve & Sebze',
  Diğer: 'Diğer',
};

const GROUP_ORDER: CategoryGroup[] = [
  'Süt & Peynir',
  'Et & Şarküteri',
  'Meyve & Sebze',
  'Sos & Baharat',
  'Diğer',
];

const GROUP_LABELS: Record<CategoryGroup, string> = {
  'Süt & Peynir': '🥛 Süt & Peynir',
  'Et & Şarküteri': '🍖 Et & Şarküteri',
  'Meyve & Sebze': '🥦 Meyve & Sebze',
  'Sos & Baharat': '🧂 Sos & Baharat',
  Diğer: '🗂️ Diğer',
};

// MVP-19: her kategori bölümü kendi soluk arka plan tonuyla ayırt ediliyor
// ("dolapta farklı raflar" hissini güçlendirir, kullanıcı isteği — bkz.
// SKILL.md). Bu 5 ton birbirinden ayırt edilsin diye ayrı bir mini palet —
// tasarım sistemindeki emerald/amber ana renk ailesinden TÜRETİLMEDİ
// (türetilseydi Süt & Peynir ve Sos & Baharat aynı aile içinde neredeyse
// ayırt edilemez olurdu). MVP-21: kart solundaki renkli şerit (eski
// `GROUP_STRIPE_COLORS`) KALDIRILDI — ürün adı artık doğrudan sola
// yaslanıyor, bu arka plan tonu artık kategori ayrımını TEK BAŞINA taşıyor.
const GROUP_BACKGROUND_COLORS: Record<CategoryGroup, string> = {
  'Süt & Peynir': '#FAF3E7', // açık krem
  'Et & Şarküteri': '#F6E8E2', // soluk terracotta
  'Meyve & Sebze': '#EAF3EA', // soluk adaçayı yeşili
  'Sos & Baharat': '#F5EFD6', // soluk hardal/altın
  Diğer: '#F3F1EE', // soluk taş grisi
};

// asset.mimeType yoksa uzantıdan tahmin için — özellikle iOS galerisinden
// gelen .MOV dosyaları sabit 'video/mp4' ile yanlış etiketleniyordu.
const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
};

function resolveVideoMimeType(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) {
    return asset.mimeType;
  }
  const extension = asset.uri.split('.').pop()?.toLowerCase();
  return (extension && VIDEO_MIME_BY_EXTENSION[extension]) || 'video/mp4';
}

// Video analizi = TAM TARAMA: mevcut envanter yeni listeyle DEĞİŞTİRİLİR
// (bkz. store/inventoryStore.ts — replaceItems). Değiştirmeden önce, henüz
// API'ye gitmeden (40+ saniyelik analizi boşa harcamamak için) onay istenir.
function confirmInventoryReplace(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Envanter yenilenecek',
      'Mevcut envanter yeni taramayla değiştirilecek, onaylıyor musun?',
      [
        { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Değiştir', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

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

// MVP-20: kaydırma (swipe) sistemi TAMAMEN kaldırıldı — kullanıcı miktar
// bilgisinin UI'da gösterilmesine gerek olmadığına karar verdi (`item.qty`
// veri modelinde/store'da KALIYOR, sadece render edilmiyor); miktar
// gösterilmeyince onu değiştirecek bir kaydırma yönlendirmesine de gerek
// kalmadı. MVP-18/19'un `PanResponder`/`Animated`/chevron/peek-hint
// mekanizmasının TAMAMI silindi — kart artık tamamen statik: `[şerit] [ad]
// [silme kutusu]` + (varsa) marka satırı. `onIncrement`/`onDecrement` bu
// bileşenden TAMAMEN kalktı (store'daki `incrementQty`/`decrementQty`
// action'ları SİLİNMEDİ — "emin olunamayan ürünler" modalı
// (`InventoryList`/`InventoryRow`, bkz. altta) hâlâ kullanıyor).
//
// MVP-10 (Bölüm B): ana kategorili listenin kart görünümü — tabak/çatal
// ikonu YOK, confidence rozeti YOK (bu liste zaten CONFIDENCE_THRESHOLD'un
// üzerindeki ürünleri gösterir, bkz. yukarıda). `components/inventory/
// InventoryRow.tsx` bu görev kapsamı dışında tutulduğu (SADECE
// index.tsx'in render/stil katmanı) için kart burada YEREL olarak
// tanımlanır — "emin olunamayan ürünler" modalı hâlâ mevcut
// `InventoryList`/`InventoryRow`'u (ikon + confidence rozetiyle, VE +/-
// butonlarıyla) kullanır, bilinçli olarak DEĞİŞTİRİLMEDİ.
//
// MVP-21: sol renkli şerit (MVP-10'dan beri vardı) KALDIRILDI — ürün adı
// artık doğrudan kartın sol kenarına yaslanıyor. Kategori ayrımı artık
// TAMAMEN `CategoryColumn`'ın arka plan tonuna (MVP-19) bırakıldı.
function ProductCard({
  item,
  onDelete,
}: {
  item: InventoryItem;
  onDelete: (id: string) => void;
}) {
  return (
    <View className="py-2">
      <View className="flex-row items-center">
        <Text
          numberOfLines={1}
          className="flex-1 text-base text-stone-900"
          style={{ fontFamily: 'Outfit_600SemiBold' }}>
          {item.name}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name} ürününü sil`}
          onPress={() => onDelete(item.id)}
          className="ml-2 h-5 w-5 items-center justify-center rounded-full active:scale-95">
          <Ionicons name="trash-outline" size={14} color="#ef4444" />
        </Pressable>
      </View>
      {item.brand && (
        <Text
          numberOfLines={1}
          className="text-xs text-stone-400"
          style={{ fontFamily: 'Outfit_400Regular' }}>
          {item.brand}
        </Text>
      )}
    </View>
  );
}

// MVP-20: kategori bölümleri tekrar YAN YANA (2'li grid) — bkz.
// `chunkPairs` kullanımı altta. Kart artık miktar metni/kaydırma
// taşımadığı için (sadece ad + silme kutusu) dar sütunda daha rahat sığıyor.
// Arka plan tonu (GROUP_BACKGROUND_COLORS, MVP-19) ve başlık chip'i
// (`bg-white/60`) DEĞİŞMEDİ. Bölüm içindeki ürünler TEK sütun.
function CategoryColumn({
  group,
  items: groupItems,
  onDelete,
}: {
  group: CategoryGroup;
  items: InventoryItem[];
  onDelete: (id: string) => void;
}) {
  return (
    <View
      className="rounded-2xl px-3 py-3"
      style={{ backgroundColor: GROUP_BACKGROUND_COLORS[group] }}>
      <View className="mb-1 self-start rounded-full bg-white/60 px-3 py-1">
        <Text className="text-sm text-stone-900" style={{ fontFamily: 'Outfit_600SemiBold' }}>
          {GROUP_LABELS[group]}
        </Text>
      </View>
      {groupItems.map((item, itemIndex) => (
        <View key={item.id} className={itemIndex > 0 ? 'border-t border-stone-900/5' : ''}>
          <ProductCard item={item} onDelete={onDelete} />
        </View>
      ))}
    </View>
  );
}

// MVP-17/20: kategori bölümlerini ikişerli satırlara bölüp yan yana
// göstermek için — tek sayıda bölümde son satırın ikinci hücresi boş kalır
// (render tarafında boş flex-1 View), son sütun tam genişliğe yayılmaz.
function chunkPairs<T>(items: T[]): [T, T | undefined][] {
  const pairs: [T, T | undefined][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push([items[i], items[i + 1]]);
  }
  return pairs;
}

export default function MutfagimScreen() {
  const items = useInventoryStore((state) => state.items);
  const addItems = useInventoryStore((state) => state.addItems);
  const replaceItems = useInventoryStore((state) => state.replaceItems);
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
    const isFullScan = asset.type === 'video';

    // TAM TARAMA onayı: video analizi mevcut envanteri değiştirecekse (liste
    // doluysa) analize başlamadan önce kullanıcıya sor — reddederse API
    // çağrısı hiç yapılmaz.
    if (isFullScan && items.length > 0 && !(await confirmInventoryReplace())) {
      return;
    }

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
          { file: videoFile, mimeType: resolveVideoMimeType(asset) },
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
      // Video = TAM TARAMA → değiştir; fiş/fotoğraf = EKLEME → birleştir
      // (bkz. store/inventoryStore.ts — replaceItems/addItems modları).
      if (isFullScan) {
        replaceItems(extractedItems);
      } else {
        addItems(extractedItems);
      }
      console.log(
        `[perf] state güncelleme (${isFullScan ? 'replaceItems' : 'addItems'}): ${(performance.now() - tBeforeAddItems).toFixed(0)}ms`
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
              kartı içinde — "dolap ve rafları" hissi. MVP-20: bölümler
              tekrar YAN YANA (2'li grid) — kart artık miktar metni/kaydırma
              taşımadığı (sadece ad + silme kutusu) için dar sütunda daha
              rahat sığıyor. Ayraç çizgi değil, her bölümün kendi
              GROUP_BACKGROUND_COLORS tonu (MVP-19, renk geçişi ayırıyor). */}
          <View className="mb-4 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-stone-200">
            <Text
              className="mb-2 text-base text-stone-500"
              style={{ fontFamily: 'Outfit_500Medium' }}>
              🧊 Buzdolabım
            </Text>
            {chunkPairs(categorizedSections).map(([leftSection, rightSection], rowIndex) => (
              <View
                key={leftSection.group}
                className={`flex-row gap-3 ${rowIndex > 0 ? 'mt-3' : ''}`}>
                <View className="flex-1">
                  <CategoryColumn
                    group={leftSection.group}
                    items={leftSection.items}
                    onDelete={removeItem}
                  />
                </View>
                {rightSection ? (
                  <View className="flex-1">
                    <CategoryColumn
                      group={rightSection.group}
                      items={rightSection.items}
                      onDelete={removeItem}
                    />
                  </View>
                ) : (
                  <View className="flex-1" />
                )}
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
