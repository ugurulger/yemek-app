import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import i18n, { getAppLanguage } from '@/src/i18n';
import { bilingualizeItemsDeferred, inventoryDisplayName } from '@/src/i18n/inventoryI18n';
import InventoryList from '@/components/inventory/InventoryList';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { LastUpdatedLabel } from '@/components/inventory/LastUpdatedLabel';
import { PantrySection } from '@/components/inventory/PantrySection';
import { Card, EmptyState, PrimaryButton } from '@/components/ui';
import {
  extractInventory,
  getVisionProvider,
  InventoryVisionError,
  type ScanProgressStage,
} from '@/services/vision';
import { extractVideoFramesAsBase64 } from '@/lib/media/extractVideoFrames';
import { resizeImageToBase64 } from '@/lib/media/resizeImageToBase64';
import { colors } from '@/lib/theme';
import { useCaptureStore } from '@/store/captureStore';
import { useInventoryStore } from '@/store/inventoryStore';
import {
  trackInventoryCaptureCompleted,
  trackInventoryCaptureFailed,
  trackInventoryCaptureStarted,
  trackInventoryUncertainItemResolved,
  type VisionProviderProp,
} from '@/tracking';
import type { InventoryCategory, InventoryItem } from '@/types/inventory';

// Analitik property'si — aktif vision sağlayıcısı (services/vision registry'si
// ile aynı env bayrağı; tracking modülü services'e bağlanmasın diye burada).
const VISION_PROVIDER_PROP: VisionProviderProp =
  process.env.EXPO_PUBLIC_VISION_PROVIDER === 'claude' ? 'claude' : 'gemini';

/** confidence < eşik ürün sayısı — capture_completed property'si. */
function countUncertain(items: InventoryItem[]): number {
  return items.filter(
    (item) => item.confidence !== undefined && item.confidence < CONFIDENCE_THRESHOLD
  ).length;
}

// Capture rotaları paralel geliştirildiği için typed-routes çıktısında henüz
// olmayabilir — Href'e cast edilir (rota adları spec §2/§3 ile sabit).
// 1 Ağu revizyonu: "Scan your fridge" (kalıcı buton + boş-durum CTA'sı)
// DOĞRUDAN kameraya gider; asistan ikincil (light) giriş olarak kalır ve
// içinde de kamera kısayolu vardır.
const CAMERA_ROUTE = '/capture/camera' as Href;
const ASSISTANT_ROUTE = '/capture/assistant' as Href;

// Aşamalı ilerleme metni (algılanan hız işi, 2026-08-02): analiz spinner'ı
// tek sabit metin yerine sağlayıcının onProgress aşamasını gösterir —
// kullanıcı 20-45sn'lik beklemede akışın İLERLEDİĞİNİ görür.
const STAGE_LABEL_KEYS: Record<ScanProgressStage, string> = {
  preparing: 'inventory.stagePreparing',
  uploading: 'inventory.stageUploading',
  analyzing: 'inventory.stageAnalyzing',
  structuring: 'inventory.stageStructuring',
};

/**
 * "Last scan" göreli zaman etiketi (kullanıcı isteği, 1 Ağu): gün içindeyse
 * saat cinsinden ("3 hours", "17 hours"), gün geçtiyse gün cinsinden
 * ("2 days"); ilk saat dolmadıysa "just now".
 */
function formatLastScan(timestamp: number): string {
  const elapsedMs = Date.now() - timestamp;
  const hours = Math.floor(elapsedMs / 3_600_000);
  if (hours < 1) {
    return i18n.t('common.justNow');
  }
  if (hours < 24) {
    return i18n.t('common.hoursShort', { count: hours });
  }
  return i18n.t('common.daysShort', { count: Math.floor(hours / 24) });
}

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
// Görüntüleme grubu → çeviri anahtarı (kategori değerleri veri olarak Türkçe
// kalır — bkz. types/inventory.ts; yalnızca GÖSTERİM çevrilir).
const GROUP_LABEL_KEYS: Record<CategoryGroup, string> = {
  'Süt & Peynir': 'categories.dairy',
  'Et & Şarküteri': 'categories.meatDeli',
  'Meyve & Sebze': 'categories.produce',
  Diğer: 'categories.other',
};

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
      i18n.t('inventory.replaceAlert.title'),
      i18n.t('inventory.replaceAlert.body'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: i18n.t('inventory.replaceAlert.confirm'), style: 'destructive', onPress: () => resolve(true) },
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
// `highlighted` true olduğunda satır ~1.7s yumuşak yeşil parlama animasyonu
// oynar (tarama onay bandına dokununca yeni eklenen ürünler; Animated.View'a
// className GÜVENİLMEZ — Plan overlay dersi — stiller düz style).
function ProductRow({
  item,
  onDelete,
  highlighted = false,
}: {
  item: InventoryItem;
  onDelete: (id: string) => void;
  highlighted?: boolean;
}) {
  const { t } = useTranslation();
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!highlighted) return;
    glow.setValue(0);
    Animated.sequence([
      // bg rengi animasyonu native driver'da desteklenmez — kısa ve az
      // satırlı olduğu için JS driver bilinçli kabul.
      Animated.timing(glow, { toValue: 1, duration: 250, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0, duration: 1200, delay: 300, useNativeDriver: false }),
    ]).start();
  }, [highlighted, glow]);
  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        // Parlama satır kutusunu hafif taşsın diye negatif yatay margin.
        marginHorizontal: -6,
        paddingHorizontal: 6,
        borderRadius: 8,
        backgroundColor: glow.interpolate({
          inputRange: [0, 1],
          outputRange: ['rgba(46,125,91,0)', 'rgba(46,125,91,0.16)'],
        }),
      }}>
      <View className="flex-1">
        <Text numberOfLines={1} className="font-sans-medium text-[13px] text-body">
          {inventoryDisplayName(item)}
        </Text>
        {item.brand && (
          <Text numberOfLines={1} className="font-sans text-xs text-muted">
            {item.brand}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('inventory.deleteItemA11y', { name: inventoryDisplayName(item) })}
        onPress={() => onDelete(item.id)}
        hitSlop={8}
        className="ml-2 active:scale-95">
        <Ionicons name="trash-outline" size={15} color={colors.trashIcon} />
      </Pressable>
    </Animated.View>
  );
}

// Kategori kartı (spec §2, görsel 01): beyaz Card, başlık satırı = pastel
// tint'li yuvarlak köşeli küçük kare içinde emoji + kategori adı; altında
// ürün satırları.
function CategoryCard({
  group,
  items: groupItems,
  onDelete,
  highlightIds,
}: {
  group: CategoryGroup;
  items: InventoryItem[];
  onDelete: (id: string) => void;
  /** Tarama onay bandından gelen "yeni eklendi" parlatması (bkz. ProductRow). */
  highlightIds?: ReadonlySet<string>;
}) {
  const meta = GROUP_META[group];
  const { t } = useTranslation();
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
          {t(GROUP_LABEL_KEYS[group])}
        </Text>
      </View>
      {groupItems.map((item) => (
        <View key={item.id} className="border-t" style={{ borderTopColor: colors.divider }}>
          <ProductRow
            item={item}
            onDelete={onDelete}
            highlighted={highlightIds?.has(item.id) ?? false}
          />
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
  const { t } = useTranslation();
  const items = useInventoryStore((state) => state.items);
  const inventoryLastUpdatedAt = useInventoryStore((state) => state.lastUpdatedAt);
  const inventoryLastScanAt = useInventoryStore((state) => state.lastScanAt);
  const addItems = useInventoryStore((state) => state.addItems);
  const replaceItems = useInventoryStore((state) => state.replaceItems);
  const incrementQty = useInventoryStore((state) => state.incrementQty);
  const decrementQty = useInventoryStore((state) => state.decrementQty);
  const removeItem = useInventoryStore((state) => state.removeItem);
  const confirmItem = useInventoryStore((state) => state.confirmItem);

  const pendingVideo = useCaptureStore((state) => state.pendingVideo);
  const clearPendingVideo = useCaptureStore((state) => state.clearPendingVideo);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<ScanProgressStage>('preparing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // DEBUG — kaldırılacak: Aşama 1 (gözlem) ham metnini görüntülemek için.
  const [observationText, setObservationText] = useState<string | null>(null);
  const [isObservationModalVisible, setIsObservationModalVisible] = useState(false);
  const [isUncertainModalVisible, setIsUncertainModalVisible] = useState(false);

  // Tarama onay bandı (kullanıcı isteği, 2026-08-02): tarama bitince tek
  // satırlık, kapatılabilir, TARAMA BAŞINA BİR KEZ görünen bant. Emin
  // olunamayan ürün varsa mesaj BİRLEŞİK ("N eklendi · M kontrol bekliyor")
  // ve bant görünürken amber kart gizlenir (çakışma olmasın — tek mesaj).
  // Dokununca envanter listesinin başına kaydırır + yeni eklenen satırlar
  // ~1.7s yumuşak yeşille parlar. Eski "N ürün bulundu" toast'ının yerini
  // aldı (aynı bilgiye iki bildirim olmasın).
  const [scanSummary, setScanSummary] = useState<{
    ids: string[];
    added: number;
    uncertain: number;
  } | null>(null);
  const [highlightIds, setHighlightIds] = useState<ReadonlySet<string>>(new Set());
  const scrollRef = useRef<ScrollView | null>(null);
  /** Kategori kartları bloğunun scroll içeriğindeki y'si (onLayout). */
  const inventoryTopYRef = useRef(0);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    []
  );

  /**
   * Taranan ürünlerin STORE'daki satır id'leri: addItems aynı ad+birim
   * kaydını birleştirip MEVCUT id'yi korur — bu yüzden id'ler yazma
   * SONRASI store'dan ad+birim eşlemesiyle çözülür (highlight doğru satırı
   * bulsun; inventoryStore.normalizeName ile aynı kural).
   */
  function resolveScannedIds(scanned: InventoryItem[]): string[] {
    const key = (name: string, unit: string) => `${name.trim().toLowerCase()}|${unit}`;
    const wanted = new Set(scanned.map((item) => key(item.name, item.unit)));
    return useInventoryStore
      .getState()
      .items.filter((item) => wanted.has(key(item.name, item.unit)))
      .map((item) => item.id);
  }

  const handleScanBandPress = () => {
    if (!scanSummary) return;
    scrollRef.current?.scrollTo({
      y: Math.max(inventoryTopYRef.current - 8, 0),
      animated: true,
    });
    setHighlightIds(new Set(scanSummary.ids));
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightIds(new Set()), 2000);
    setScanSummary(null);
  };

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

    trackInventoryCaptureStarted('video');
    setIsAnalyzing(true);
    setAnalysisStage('preparing');
    // MVP-9 (performans): video seçiminden envanterin ekrana gelmesine kadar
    // geçen süreyi aşamalara ayırıp loglamak için — bkz. SKILL.md "Performans
    // notları". Ağ isteği + parse süreleri services/vision/gemini-provider.ts
    // içinde ayrıca loglanıyor (bkz. `logStage`).
    const tPickStart = performance.now();
    // Aşama telemetrisi: 'analyzing' geçişi = model isteğinin başlangıcı;
    // öncesi hazırlık (base64 + varsa Files API yüklemesi). prep_ms/model_ms
    // capture_completed'a yazılır (tracking-plan v1.1).
    let tModelStart: number | null = null;
    const onProgress = (stage: ScanProgressStage) => {
      setAnalysisStage(stage);
      if (stage === 'analyzing' && tModelStart === null) {
        tModelStart = performance.now();
      }
    };

    // Tarama dili = tarama BAŞLATILDIĞI ANDAKİ uygulama dili (kullanıcı
    // kararı): API çağrısı bu dilde yapılır; analiz sürerken dil değişse bile
    // bu tarama başladığı dilin sonucunu üretir, çeviri adımı karşı dili ekler.
    const scanLanguage = getAppLanguage();

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
          { onObservation: setObservationText, language: scanLanguage, onProgress }
        );
      } else {
        // Geriye dönük uyumluluk: sağlayıcı native-video desteklemiyorsa
        // (örn. Claude seçiliyse) eski kare-tabanlı akış kullanılır.
        // (İki aşamalı akışın prompt'ları Türkçe — adlar TR üretilir, EN
        // karşılığı aşağıdaki çeviri adımıyla eklenir.)
        const frames = await extractVideoFramesAsBase64(uri);
        if (frames.length === 0) {
          throw new InventoryVisionError(t('errors.videoProcessing'));
        }
        extractedItems = await extractInventory(frames, {
          onObservation: setObservationText,
          onProgress,
        });
      }

      // ÇEVİRİ ADIMI KRİTİK YOL DIŞINDA (performans işi, 2026-08-02):
      // önceki `await bilingualizeItems` karşı dil çevirisini (~1.1s haiku
      // çağrısı) sonuçlar ekrana yazılmadan ÖNCE bekletiyordu. Deferred sürüm
      // kaynak dil alanını senkron doldurur, karşı dili arka planda id bazlı
      // yamalar (bkz. src/i18n/inventoryI18n.ts) — dil değişiminde backfill
      // emniyet ağı aynen durur.
      const nativeVideoUsed = Boolean(videoProvider.extractInventoryFromVideo);
      extractedItems = bilingualizeItemsDeferred(
        extractedItems,
        nativeVideoUsed ? scanLanguage : 'tr'
      );

      const tBeforeReplace = performance.now();
      // Video = TAM TARAMA → değiştir (bkz. store/inventoryStore.ts).
      replaceItems(extractedItems);
      // Algılanan hız: sonuç anında görünür + sayılı geri bildirim
      // (onay bandı — toast yerine, bkz. scanSummary).
      setScanSummary({
        ids: resolveScannedIds(extractedItems),
        added: extractedItems.length,
        uncertain: countUncertain(extractedItems),
      });
      console.log(
        `[perf] state güncelleme (replaceItems): ${(performance.now() - tBeforeReplace).toFixed(0)}ms`
      );
      console.log(
        `[perf] TOPLAM (seçimden envanterin state'e yazılmasına): ${(performance.now() - tPickStart).toFixed(0)}ms`
      );
      trackInventoryCaptureCompleted({
        method: 'video',
        provider: VISION_PROVIDER_PROP,
        item_count: extractedItems.length,
        uncertain_item_count: countUncertain(extractedItems),
        write_mode: 'replace',
        duration_ms: performance.now() - tPickStart,
        ...(tModelStart === null
          ? {}
          : {
              prep_ms: tModelStart - tPickStart,
              model_ms: performance.now() - tModelStart,
            }),
      });
    } catch (error) {
      // Vision hata mesajları (services/vision) Türkçe — ekranda çevrilmiş
      // genel mesaj gösterilir, orijinali console'a düşer (ekran sınırı
      // kararı; services Node eval script'lerinden de import ediliyor).
      console.warn('[inventory] video analiz hatası:', error);
      trackInventoryCaptureFailed({
        method: 'video',
        provider: VISION_PROVIDER_PROP,
        error_type: error instanceof InventoryVisionError ? 'empty_result' : 'unknown',
        duration_ms: performance.now() - tPickStart,
      });
      setErrorMessage(t('errors.analysisFailed'));
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
      trackInventoryCaptureFailed({
        method: 'photo',
        provider: VISION_PROVIDER_PROP,
        error_type: 'permission',
      });
      setErrorMessage(t('errors.galleryPermission'));
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

    trackInventoryCaptureStarted('photo');
    setIsAnalyzing(true);
    setAnalysisStage('preparing');
    const tPickStart = performance.now();
    // Aşama telemetrisi — analyzeVideo'daki kalıpla aynı.
    let tModelStart: number | null = null;
    const onProgress = (stage: ScanProgressStage) => {
      setAnalysisStage(stage);
      if (stage === 'analyzing' && tModelStart === null) {
        tModelStart = performance.now();
      }
    };

    try {
      // Fotoğrafı vision'a göndermeden önce boyutlandır: tam çözünürlüklü
      // telefon fotoğrafları API limitlerini zorlar, yavaş ve pahalıdır.
      const image = await resizeImageToBase64(asset.uri, asset.width, asset.height);
      const extractedItems = await extractInventory([image], {
        onObservation: setObservationText,
        onProgress,
      });

      // Fotoğraf akışının prompt'ları Türkçe — EN karşılıkları arka plan
      // çeviri yamasıyla eklenir (bkz. analyzeVideo'daki deferred notu).
      const bilingualItems = bilingualizeItemsDeferred(extractedItems, 'tr');

      const tBeforeAddItems = performance.now();
      // Fiş/fotoğraf = EKLEME → birleştir (bkz. store/inventoryStore.ts).
      addItems(bilingualItems);
      // Onay bandı — toast yerine (bkz. scanSummary).
      setScanSummary({
        ids: resolveScannedIds(bilingualItems),
        added: bilingualItems.length,
        uncertain: countUncertain(bilingualItems),
      });
      console.log(
        `[perf] state güncelleme (addItems): ${(performance.now() - tBeforeAddItems).toFixed(0)}ms`
      );
      console.log(
        `[perf] TOPLAM (seçimden envanterin state'e yazılmasına): ${(performance.now() - tPickStart).toFixed(0)}ms`
      );
      trackInventoryCaptureCompleted({
        method: 'photo',
        provider: VISION_PROVIDER_PROP,
        item_count: bilingualItems.length,
        uncertain_item_count: countUncertain(bilingualItems),
        write_mode: 'add',
        duration_ms: performance.now() - tPickStart,
        ...(tModelStart === null
          ? {}
          : {
              prep_ms: tModelStart - tPickStart,
              model_ms: performance.now() - tModelStart,
            }),
      });
    } catch (error) {
      console.warn('[inventory] fotoğraf analiz hatası:', error);
      trackInventoryCaptureFailed({
        method: 'photo',
        provider: VISION_PROVIDER_PROP,
        error_type: error instanceof InventoryVisionError ? 'empty_result' : 'unknown',
        duration_ms: performance.now() - tPickStart,
      });
      setErrorMessage(t('errors.analysisFailed'));
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
        ref={scrollRef}
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Başlık bloğu — birebir referans (satır 57-63): sayfa padding
            8px 20px 120px; selamlama 400 13px #8A9088 ls .3; h1 Newsreader
            500 34px #1F4A3D, üstten 2px. Görseldeki "Elif" adı
            kişiselleştirme — isim yok. */}
        <View className="mb-1.5 flex-row items-start justify-between pt-2">
          <View>
            <Text className="font-sans text-[13px] text-muted" style={{ letterSpacing: 0.3 }}>
              {t('inventory.greeting')}
            </Text>
            <Text className="mt-[2px] font-serif text-[34px] leading-[40px] text-forest">
              {t('inventory.title')}
            </Text>
          </View>
          {/* Dil seçici (EN/TR) — Blok B "ayarlar" gereksinimi, kompakt pill.
              Yanında Ayarlar (dişli) — gizlilik/destek bağlantıları orada. */}
          <View className="flex-row items-center gap-2 pt-1">
            <LanguageSelector />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.openA11y')}
              onPress={() => router.push('/settings')}
              className="h-[30px] w-[30px] items-center justify-center rounded-full bg-sand active:scale-95">
              <Ionicons name="settings-outline" size={15} color={colors.forest} />
            </Pressable>
          </View>
        </View>

        {/* "Buzdolabım" bölüm başlığı + sayaç pili — birebir referans
            (satır 66-69): margin 20 üst 12 alt, gap 8; başlık Newsreader
            500 20px #23302B; pil 600 11px #8A9088 bg sand 3×9 radius 20. */}
        <View className="mt-5 flex-row items-center gap-2">
          <Text className="font-serif text-[20px] text-ink">{t('inventory.fridgeTitle')}</Text>
          <View className="rounded-[20px] bg-sand px-[9px] py-[3px]">
            <Text className="font-sans-semibold text-[11px] text-muted">
              {t('inventory.itemCount', { count: items.length })}
            </Text>
          </View>
        </View>
        {/* İş 2: bloğun son değişiklik tarihi — düşük görsel ağırlıklı satır. */}
        <LastUpdatedLabel timestamp={inventoryLastUpdatedAt} className="mt-1" />

        {/* 1 Ağu revizyonu: KALICI "Scan your fridge" primary butonu (envanter
            geldikten sonra da görünür) + üstünde son tarama zamanı etiketi;
            altında ikincil (light) asistan girişi. Fiş/fotoğraf picker akışı
            alttaki text-link'te yaşamaya devam ediyor. */}
        <View className="mt-3 gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('inventory.scanFridge')}
            disabled={isAnalyzing}
            onPress={() => router.push(CAMERA_ROUTE)}
            className="items-center rounded-[14px] bg-forest px-3 py-[9px] active:scale-[0.98]"
            style={{
              shadowColor: '#1F4A3D',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 3,
              opacity: isAnalyzing ? 0.6 : 1,
            }}>
            <View className="flex-row items-center gap-2">
              <Ionicons name="videocam" size={16} color="white" />
              <Text className="font-sans-semibold text-[12px] text-white">
                {t('inventory.scanFridge')}
              </Text>
            </View>
            {inventoryLastScanAt ? (
              <Text
                className="mt-[2px] font-sans text-[10px]"
                style={{ color: 'rgba(255,255,255,0.72)' }}>
                {t('inventory.lastScan', { time: formatLastScan(inventoryLastScanAt) })}
              </Text>
            ) : null}
          </Pressable>
          <PrimaryButton
            size="small"
            variant="light"
            label={t('inventory.addWithAssistant')}
            disabled={isAnalyzing}
            icon={<Text className="text-[13px] text-forest">✦</Text>}
            onPress={() => router.push(ASSISTANT_ROUTE)}
          />
        </View>

        {/* Fiş/fotoğraf yükleme: referansta YOK ama işlev kararıyla tutulan
            ikincil text-link — muted 11.5px stilinde. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('inventory.uploadReceiptA11y')}
          onPress={handlePickAndAnalyze}
          disabled={isAnalyzing}
          className="mt-2.5 flex-row items-center self-start active:scale-95">
          <Ionicons name="images-outline" size={13} color={colors.muted} />
          <Text className="ml-1.5 font-sans text-[11.5px] text-muted">
            {t('inventory.uploadReceipt')}
          </Text>
        </Pressable>

        {isAnalyzing && (
          <Card className="mt-3 flex-row items-center px-4 py-3">
            <ActivityIndicator color={colors.forest} size="small" />
            <Text className="ml-3 font-sans text-sm text-body">
              {t(STAGE_LABEL_KEYS[analysisStage])}
            </Text>
          </Card>
        )}

        {errorMessage && (
          <Card className="mt-3 px-4 py-3">
            <Text className="font-sans-medium text-sm text-red-500">{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={handlePickAndAnalyze}
              className="mt-2 self-start active:scale-95">
              <Text className="font-sans-medium text-sm text-forest">{t('common.retry')}</Text>
            </Pressable>
          </Card>
        )}

        {/* DEBUG — kaldırılacak: Aşama 1 (gözlem) ham metnini görüntüleme butonu.
            Yalnız geliştirmede görünür (__DEV__) — store build'ine sızmaz. */}
        {__DEV__ && observationText && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsObservationModalVisible(true)}
            className="mt-2 self-start active:scale-95">
            <Text className="font-sans-medium text-xs text-muted2">[DEBUG] Ham Metni Gör</Text>
          </Pressable>
        )}

        {/* Tarama onay bandı — tek satır, hafif softgreen vurgu; dokununca
            listeye kaydırıp yeni satırları parlatır, X kalıcı kapatır.
            Emin olunamayan sayısı varsa mesaja gömülür (amber kartla aynı
            anda İKİ mesaj gösterilmez). */}
        {scanSummary ? (
          <View className="mt-4 flex-row items-center rounded-2xl bg-softgreen-bg py-2 pl-3.5 pr-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('inventory.scanBandA11y')}
              onPress={handleScanBandPress}
              className="flex-1 flex-row items-center gap-1.5 active:opacity-70">
              <Text
                numberOfLines={1}
                className="flex-1 font-sans-semibold text-[12.5px] text-softgreen-text">
                {scanSummary.uncertain > 0
                  ? t('inventory.scanBandCombined', {
                      count: scanSummary.added,
                      uncertain: scanSummary.uncertain,
                    })
                  : t('inventory.scanBand', { count: scanSummary.added })}
              </Text>
              {/* softgreen.text — tailwind token'ının hex'i (ikonlar className almaz). */}
              <Ionicons name="arrow-down-circle-outline" size={16} color="#2E7D5B" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('inventory.scanBandDismissA11y')}
              onPress={() => setScanSummary(null)}
              hitSlop={8}
              className="p-1.5 active:scale-90">
              <Ionicons name="close" size={14} color="#2E7D5B" />
            </Pressable>
          </View>
        ) : null}

        {/* "Emin olunamayan ürünler" uyarı kartı — amber tonları yeni
            paletten (bg-amber-soft, text-amber-text), akış AYNEN korundu.
            Onay bandı görünürken GİZLİ (bilgisi banda gömülü — tek mesaj). */}
        {uncertainItems.length > 0 && !scanSummary && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('inventory.reviewUncertainA11y')}
            onPress={() => setIsUncertainModalVisible(true)}
            className="mt-4 flex-row items-center justify-between rounded-2xl bg-amber-soft px-4 py-3 active:scale-95">
            <Text className="flex-1 font-sans-semibold text-sm text-amber-text">
              {t('inventory.uncertainWaiting', { count: uncertainItems.length })}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.amberText} />
          </Pressable>
        )}

        {/* Kategori kartları — İKİ SÜTUN (spec §2, görsel 01). Dış sarmalayıcı
            onLayout: onay bandının "listeye kaydır" hedefi (scroll içeriği y). */}
        {hasItems ? (
          <View
            onLayout={(event) => {
              inventoryTopYRef.current = event.nativeEvent.layout.y;
            }}>
            {chunkPairs(categorizedSections).map(([leftSection, rightSection]) => (
              <View key={leftSection.group} className="mt-3 flex-row gap-3">
                <View className="flex-1">
                  <CategoryCard
                    group={leftSection.group}
                    items={leftSection.items}
                    onDelete={removeItem}
                    highlightIds={highlightIds}
                  />
                </View>
                {rightSection ? (
                  <View className="flex-1">
                    <CategoryCard
                      group={rightSection.group}
                      items={rightSection.items}
                      onDelete={removeItem}
                      highlightIds={highlightIds}
                    />
                  </View>
                ) : (
                  <View className="flex-1" />
                )}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            className="mt-3"
            emoji="🧺"
            title={t('inventory.emptyTitle')}
            body={t('inventory.emptyBody')}
            ctaLabel={t('inventory.emptyCta')}
            onPressCta={() => router.push(CAMERA_ROUTE)}
          />
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
            <Text className="font-serif text-lg text-ink">{t('inventory.uncertainModalTitle')}</Text>
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
              onDelete={(id) => {
                trackInventoryUncertainItemResolved('deleted');
                removeItem(id);
              }}
              onConfirm={(id) => {
                trackInventoryUncertainItemResolved('added');
                confirmItem(id);
              }}
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
            <Text className="font-serif text-lg text-ink">[DEBUG] Aşama 1: Ham Gözlem Metni</Text>
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
