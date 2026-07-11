import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import InventoryList from '@/components/inventory/InventoryList';
import { PantrySection } from '@/components/inventory/PantrySection';
import { Card, PrimaryButton } from '@/components/ui';
import { extractInventory, getVisionProvider, InventoryVisionError } from '@/services/vision';
import { extractVideoFramesAsBase64 } from '@/lib/media/extractVideoFrames';
import { resizeImageToBase64 } from '@/lib/media/resizeImageToBase64';
import { colors } from '@/lib/theme';
import { useCaptureStore } from '@/store/captureStore';
import { useInventoryStore } from '@/store/inventoryStore';
import type { InventoryCategory, InventoryItem } from '@/types/inventory';

// Capture rotaları paralel geliştirildiği için typed-routes çıktısında henüz
// olmayabilir — Href'e cast edilir (rota adları spec §2/§3 ile sabit).
const CAMERA_ROUTE = '/capture/camera' as Href;
const ASSISTANT_ROUTE = '/capture/assistant' as Href;

// Bu skorun altındaki ürünler kategorili listede YER KAPLAMAZ — bunun yerine
// listenin üstünde tek satırlık bir özet gösterilir, tıklanınca bir modalde
// tam kart olarak gösterilirler (bkz. services/vision/prompt.ts —
// match_confidence). MVP-8'de 50 → 90'a çıkarıldı: kullanıcı belirsiz
// ürünlerin ana listede yer kaplamasını istemedi, eşik yükseltilerek daha
// az ürün "kesin" sayılıyor.
const CONFIDENCE_THRESHOLD = 90;

// Redesign (spec §2): ham 7 kategori (types/inventory.ts —
// INVENTORY_CATEGORIES, video akışının responseSchema'sı dayatır)
// görüntülemede 4 üst gruba birleştirilir — sadece GÖRÜNTÜLEME gruplaması,
// ham `item.category` aynen saklanır. MVP-10/17'nin 5'li grubundaki
// "Sos & Baharat" spec'in 4 kartlı düzenine uymak için "Diğer"e katlandı
// (spec kazandı).
type CategoryGroup = 'Süt & Peynir' | 'Et & Şarküteri' | 'Meyve & Sebze' | 'Diğer';

const CATEGORY_GROUPS: Record<InventoryCategory, CategoryGroup> = {
  'Süt Ürünleri': 'Süt & Peynir',
  Peynir: 'Süt & Peynir',
  Şarküteri: 'Et & Şarküteri',
  İçecek: 'Diğer',
  'Sos & Baharat': 'Diğer',
  'Meyve & Sebze': 'Meyve & Sebze',
  Diğer: 'Diğer',
};

const GROUP_ORDER: CategoryGroup[] = ['Süt & Peynir', 'Et & Şarküteri', 'Meyve & Sebze', 'Diğer'];

// Kart başlığı: pastel tint'li yuvarlak köşeli kare rozet içinde emoji
// (spec §1 pastel tint'ler + görsel 01) — MVP-19'un pastel ARKA PLANLI
// CategoryColumn stilinin yerini bu beyaz kart + tint rozet stili aldı.
const GROUP_META: Record<CategoryGroup, { emoji: string; tint: string }> = {
  'Süt & Peynir': { emoji: '🧀', tint: colors.tintSut },
  'Et & Şarküteri': { emoji: '🥩', tint: colors.tintEt },
  'Meyve & Sebze': { emoji: '🥬', tint: colors.tintSebze },
  Diğer: { emoji: '🥚', tint: colors.tintDiger },
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

function resolveVideoMimeType(uri: string, mimeType?: string): string {
  if (mimeType) {
    return mimeType;
  }
  const extension = uri.split('.').pop()?.toLowerCase();
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

// Satır: ürün adı (varsa marka küçük gri altta, mevcut davranış) + sağda
// çöp ikonu — birebir referans (Mutfagim.dc.html satır 88-93): padding 6px 0,
// ad 500 13px #3A463F, çöp ikonu 15px #C7B7A8.
function ProductRow({
  item,
  onDelete,
}: {
  item: InventoryItem;
  onDelete: (id: string) => void;
}) {
  return (
    <View className="flex-row items-center py-1.5">
      <View className="flex-1">
        <Text numberOfLines={1} className="font-sans-medium text-[13px] text-body">
          {item.name}
        </Text>
        {item.brand && (
          <Text numberOfLines={1} className="font-sans text-xs text-muted">
            {item.brand}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name} ürününü sil`}
        onPress={() => onDelete(item.id)}
        hitSlop={8}
        className="ml-2 active:scale-95">
        <Ionicons name="trash-outline" size={15} color={colors.trashIcon} />
      </Pressable>
    </View>
  );
}

// Kategori kartı (spec §2, görsel 01): beyaz Card, başlık satırı = pastel
// tint'li yuvarlak köşeli küçük kare içinde emoji + kategori adı; altında
// ürün satırları.
function CategoryCard({
  group,
  items: groupItems,
  onDelete,
}: {
  group: CategoryGroup;
  items: InventoryItem[];
  onDelete: (id: string) => void;
}) {
  const meta = GROUP_META[group];
  return (
    // Birebir referans (satır 82-86): radius 22, padding 14/14/8, başlık
    // satırı gap 7 + mb 9, emoji kutusu 28×28 radius 9, emoji 15px,
    // kategori adı 600 12.5px #23302B. Card varsayılanı radius 18 —
    // style prop'u className'i ezdiği için 22 buradan verilir.
    <Card className="px-3.5 pb-2 pt-3.5" style={{ borderRadius: 22 }}>
      <View className="mb-[9px] flex-row items-center">
        <View
          className="h-7 w-7 items-center justify-center rounded-[9px]"
          style={{ backgroundColor: meta.tint }}>
          <Text className="text-[15px]">{meta.emoji}</Text>
        </View>
        <Text
          numberOfLines={1}
          className="ml-[7px] flex-1 font-sans-semibold text-[12.5px] text-ink">
          {group}
        </Text>
      </View>
      {groupItems.map((item) => (
        <View key={item.id} className="border-t" style={{ borderTopColor: colors.divider }}>
          <ProductRow item={item} onDelete={onDelete} />
        </View>
      ))}
    </Card>
  );
}

// Kategori kartlarını ikişerli satırlara bölüp yan yana göstermek için —
// tek sayıda kartta son satırın ikinci hücresi boş kalır (boş flex-1 View),
// son kart tam genişliğe yayılmaz.
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

  const pendingVideo = useCaptureStore((state) => state.pendingVideo);
  const clearPendingVideo = useCaptureStore((state) => state.clearPendingVideo);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // DEBUG — kaldırılacak: Aşama 1 (gözlem) ham metnini görüntülemek için.
  const [observationText, setObservationText] = useState<string | null>(null);
  const [isObservationModalVisible, setIsObservationModalVisible] = useState(false);
  const [isUncertainModalVisible, setIsUncertainModalVisible] = useState(false);

  // Kamera köprüsü (spec §3): tam ekran kamera rotası kaydı bitirince videoyu
  // captureStore'a bırakıp geri döner — burada yakalanır, temizlenir ve
  // MEVCUT video analiz akışı (Alert onayı dahil) o uri/mimeType ile başlar.
  useEffect(() => {
    if (!pendingVideo) {
      return;
    }
    const video = pendingVideo;
    clearPendingVideo();
    void analyzeVideo(video.uri, resolveVideoMimeType(video.uri, video.mimeType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVideo]);

  // Video = TAM TARAMA akışı — hem galeri seçiminden (handlePickAndAnalyze)
  // hem kamera köprüsünden (pendingVideo effect'i) aynı uri/mimeType
  // imzasıyla çağrılır.
  async function analyzeVideo(uri: string, mimeType: string) {
    setErrorMessage(null);
    setObservationText(null);

    // TAM TARAMA onayı: mevcut envanter değiştirilecekse (liste doluysa)
    // analize başlamadan önce kullanıcıya sor — reddederse API çağrısı
    // hiç yapılmaz.
    if (items.length > 0 && !(await confirmInventoryReplace())) {
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

      if (videoProvider.extractInventoryFromVideo) {
        // MVP-7: sağlayıcı native-video akışını destekliyorsa (şu an sadece
        // Gemini) kare çıkarma TAMAMEN atlanır, ham video tek çağrıda
        // gönderilir (bkz. services/vision/gemini-provider.ts).
        // MVP-9 (performans): video burada ARTIK base64'e çevrilmiyor —
        // `File` zaten bir `Blob`, sağlayıcıya doğrudan geçiriliyor.
        const videoFile = new File(uri);
        console.log(
          `[perf] video seçiminden isteğe (dosya hazırlama): ${(performance.now() - tPickStart).toFixed(0)}ms`
        );
        extractedItems = await videoProvider.extractInventoryFromVideo(
          { file: videoFile, mimeType },
          { onObservation: setObservationText }
        );
      } else {
        // Geriye dönük uyumluluk: sağlayıcı native-video desteklemiyorsa
        // (örn. Claude seçiliyse) eski kare-tabanlı akış kullanılır.
        const frames = await extractVideoFramesAsBase64(uri);
        if (frames.length === 0) {
          throw new InventoryVisionError('Video işlenemedi, tekrar deneyin.');
        }
        extractedItems = await extractInventory(frames, { onObservation: setObservationText });
      }

      const tBeforeReplace = performance.now();
      // Video = TAM TARAMA → değiştir (bkz. store/inventoryStore.ts).
      replaceItems(extractedItems);
      console.log(
        `[perf] state güncelleme (replaceItems): ${(performance.now() - tBeforeReplace).toFixed(0)}ms`
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

  // Fiş/fotoğraf yükleme akışı (galeri picker) — video seçilirse TAM TARAMA
  // akışına (analyzeVideo) devredilir, fotoğraf ise EKLEME modunda analiz
  // edilir (addItems).
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

    if (asset.type === 'video') {
      await analyzeVideo(asset.uri, resolveVideoMimeType(asset.uri, asset.mimeType));
      return;
    }

    setIsAnalyzing(true);
    const tPickStart = performance.now();

    try {
      // Fotoğrafı vision'a göndermeden önce boyutlandır: tam çözünürlüklü
      // telefon fotoğrafları API limitlerini zorlar, yavaş ve pahalıdır.
      const image = await resizeImageToBase64(asset.uri, asset.width, asset.height);
      const extractedItems = await extractInventory([image], {
        onObservation: setObservationText,
      });

      const tBeforeAddItems = performance.now();
      // Fiş/fotoğraf = EKLEME → birleştir (bkz. store/inventoryStore.ts).
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
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Başlık bloğu — birebir referans (satır 57-63): sayfa padding
            8px 20px 120px; selamlama 400 13px #8A9088 ls .3; h1 Newsreader
            500 34px #1F4A3D, üstten 2px. Görseldeki "Elif" adı
            kişiselleştirme — isim yok. */}
        <View className="mb-1.5 pt-2">
          <Text className="font-sans text-[13px] text-muted" style={{ letterSpacing: 0.3 }}>
            Merhaba 👋
          </Text>
          <Text className="mt-[2px] font-serif text-[34px] leading-[40px] text-forest">
            Mutfağım
          </Text>
        </View>

        {/* "Buzdolabım" bölüm başlığı + sayaç pili — birebir referans
            (satır 66-69): margin 20 üst 12 alt, gap 8; başlık Newsreader
            500 20px #23302B; pil 600 11px #8A9088 bg sand 3×9 radius 20. */}
        <View className="mt-5 flex-row items-center gap-2">
          <Text className="font-serif text-[20px] text-ink">Buzdolabım</Text>
          <View className="rounded-[20px] bg-sand px-[9px] py-[3px]">
            <Text className="font-sans-semibold text-[11px] text-muted">{items.length} ürün</Text>
          </View>
        </View>

        {/* İki kompakt buton (referans satır 70-79): gap 8, alt margin 14;
            kamera = size 'small' primary (videocam 18 beyaz), asistan =
            size 'small' light (✦ 13px forest). Fiş/fotoğraf picker akışı
            alttaki ikincil text-link'te yaşamaya devam ediyor. */}
        <View className="mt-3 flex-row gap-2">
          <View className="flex-1">
            <PrimaryButton
              size="small"
              label="Kamerayla tara"
              disabled={isAnalyzing}
              icon={<Ionicons name="videocam" size={18} color="white" />}
              onPress={() => router.push(CAMERA_ROUTE)}
            />
          </View>
          <View className="flex-1">
            <PrimaryButton
              size="small"
              variant="light"
              label="Asistanla ekle"
              disabled={isAnalyzing}
              icon={<Text className="text-[13px] text-forest">✦</Text>}
              onPress={() => router.push(ASSISTANT_ROUTE)}
            />
          </View>
        </View>

        {/* Fiş/fotoğraf yükleme: referansta YOK ama işlev kararıyla tutulan
            ikincil text-link — muted 11.5px stilinde. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fiş veya fotoğraf yükle"
          onPress={handlePickAndAnalyze}
          disabled={isAnalyzing}
          className="mt-2.5 flex-row items-center self-start active:scale-95">
          <Ionicons name="images-outline" size={13} color={colors.muted} />
          <Text className="ml-1.5 font-sans text-[11.5px] text-muted">Fiş/fotoğraf yükle</Text>
        </Pressable>

        {isAnalyzing && (
          <Card className="mt-3 flex-row items-center px-4 py-3">
            <ActivityIndicator color={colors.forest} size="small" />
            <Text className="ml-3 font-sans text-sm text-body">Buzdolabı analiz ediliyor…</Text>
          </Card>
        )}

        {errorMessage && (
          <Card className="mt-3 px-4 py-3">
            <Text className="font-sans-medium text-sm text-red-500">{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={handlePickAndAnalyze}
              className="mt-2 self-start active:scale-95">
              <Text className="font-sans-medium text-sm text-forest">Tekrar dene</Text>
            </Pressable>
          </Card>
        )}

        {/* DEBUG — kaldırılacak: Aşama 1 (gözlem) ham metnini görüntüleme butonu. */}
        {observationText && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsObservationModalVisible(true)}
            className="mt-2 self-start active:scale-95">
            <Text className="font-sans-medium text-xs text-muted2">[DEBUG] Ham Metni Gör</Text>
          </Pressable>
        )}

        {/* "Emin olunamayan ürünler" uyarı kartı — amber tonları yeni
            paletten (bg-amber-soft, text-amber-text), akış AYNEN korundu. */}
        {uncertainItems.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emin olunamayan ürünleri gözden geçir"
            onPress={() => setIsUncertainModalVisible(true)}
            className="mt-4 flex-row items-center justify-between rounded-2xl bg-amber-soft px-4 py-3 active:scale-95">
            <Text className="flex-1 font-sans-semibold text-sm text-amber-text">
              ⚠️ {uncertainItems.length} ürün kontrol bekliyor
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.amberText} />
          </Pressable>
        )}

        {/* Kategori kartları — İKİ SÜTUN (spec §2, görsel 01). */}
        {hasItems ? (
          chunkPairs(categorizedSections).map(([leftSection, rightSection]) => (
            <View key={leftSection.group} className="mt-3 flex-row gap-3">
              <View className="flex-1">
                <CategoryCard
                  group={leftSection.group}
                  items={leftSection.items}
                  onDelete={removeItem}
                />
              </View>
              {rightSection ? (
                <View className="flex-1">
                  <CategoryCard
                    group={rightSection.group}
                    items={rightSection.items}
                    onDelete={removeItem}
                  />
                </View>
              ) : (
                <View className="flex-1" />
              )}
            </View>
          ))
        ) : (
          <Card className="mt-3 items-center px-6 py-8">
            <Text className="text-4xl">🧺</Text>
            <Text className="mt-3 font-serif text-lg text-ink">Buzdolabın henüz boş</Text>
            <Text className="mt-1.5 text-center font-sans text-sm text-muted">
              Kamerayla tarayarak buzdolabını tanıt ya da fiş/fotoğraf yükle.
            </Text>
          </Card>
        )}

        {/* Temel Malzemeler bloğu (spec §2, görsel 02). */}
        <PantrySection />
      </ScrollView>

      {/* Confidence < CONFIDENCE_THRESHOLD ürünler burada tam kart olarak
          gösterilir (mevcut "Envantere ekle" akışıyla) — ana kategorili
          listede yer kaplamazlar, bkz. yukarıdaki özet satırı. */}
      <Modal
        visible={isUncertainModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsUncertainModalVisible(false)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
            <Text className="font-serif text-lg text-ink">Emin olunamayan ürünler</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsUncertainModalVisible(false)}
              className="active:scale-95">
              <Ionicons name="close" size={24} color={colors.ink} />
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
          <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
            <Text className="font-serif text-lg text-ink">[DEBUG] Aşama 1 — Ham Gözlem Metni</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsObservationModalVisible(false)}
              className="active:scale-95">
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView className="flex-1 px-5 py-2">
            <Text className="font-sans text-sm text-body">{observationText}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
