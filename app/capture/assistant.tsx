import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { parseIngredients, type ParsedIngredient } from '@/lib/claude/parseIngredients';
import { getAppLanguage, llmOutputLanguage } from '@/src/i18n';
import {
  backfillInventoryTranslations,
  backfillPantryTranslations,
} from '@/src/i18n/inventoryI18n';
import { Chip, PrimaryButton, SectionLabel } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useInventoryStore } from '@/store/inventoryStore';
import { usePantryStore } from '@/store/pantryStore';
import type { InventoryItem } from '@/types/inventory';

/** Kapat butonu gölgesi — referans 584: 0 2px 8px -3px rgba(31,74,61,.25). */
const CLOSE_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 3,
} as const;

/** Arama barı gölgesi — referans 597: 0 14px 30px -14px rgba(31,74,61,.4). */
const SEARCH_BAR_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.4,
  shadowRadius: 15,
  elevation: 8,
} as const;

/** Chip metni: miktar 1'den büyükse "4× Domates", değilse sadece ad. */
function chipLabel(item: InventoryItem): string {
  return item.qty > 1 ? `${item.qty}× ${item.name}` : item.name;
}

/**
 * Asistanla Ekle — görsel değerler BİREBİR referans:
 * design/reference/Mutfagim.dc.html satır 580-629 + 980-984. `mode` paramı
 * hedef store'u seçer: 'inventory' (varsayılan) → Buzdolabım envanteri,
 * 'pantry' → Temel Malzemeler. Metin, parseIngredients (lib/claude) ile
 * malzemelere ayrıştırılır; mikrofon MVP'de pasiftir (Alert).
 */
export default function AssistantAddScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const targetMode: 'inventory' | 'pantry' = mode === 'pantry' ? 'pantry' : 'inventory';

  const addInventoryItems = useInventoryStore((state) => state.addItems);
  const addPantryItems = usePantryStore((state) => state.addItems);

  const [text, setText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedIngredient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDone, setIsDone] = useState(false);

  const selectedCount = selectedIds.size;
  const hasParsed = parsedItems.length > 0;

  async function handleParse() {
    const query = text.trim();
    if (!query || isParsing) {
      return;
    }
    setIsParsing(true);
    try {
      // Malzeme adları aktif uygulama dilinde üretilir (BLOK B / B3).
      const items = await parseIngredients(query, { outputLanguage: llmOutputLanguage() });
      setParsedItems(items);
      // Hepsi başta seçili gelir; kullanıcı dokunarak çıkarır.
      setSelectedIds(new Set(items.map((item) => item.id)));
      setText('');
    } catch (error) {
      console.warn('[assistant] ayrıştırma hatası:', error);
      Alert.alert(t('assistant.parseFailedTitle'), t('assistant.parseFailedBody'));
    } finally {
      setIsParsing(false);
    }
  }

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleAdd() {
    const selected = parsedItems.filter((item) => selectedIds.has(item.id));
    if (selected.length === 0) {
      return;
    }
    // Adlar aktif dilde üretildi (parseIngredients outputLanguage) — kiler
    // kaydına kaynak dilin alanı hemen yazılır, karşı dil backfill'e kalır.
    const sourceLanguageField = getAppLanguage() === 'tr' ? 'nameTr' : 'nameEn';
    if (targetMode === 'pantry') {
      // Kiler modunda kategori: bakliyat/tahıl kendi kategorisine, kalanı 'Kiler'.
      addPantryItems(
        selected.map((item) => ({
          name: item.name,
          [sourceLanguageField]: item.name,
          category: item.pantryCategory ?? ('Kiler' as const),
          active: true,
        }))
      );
    } else {
      // Envanter modunda bile bakliyat/tahıl (nohut, mercimek, pirinç...)
      // buzdolabına DEĞİL, alt kısımdaki Temel Malzemeler'in "Bakliyat &
      // Makarna" kategorisine gider (kullanıcı kararı, kategori düzeltmesi).
      const pantryBound = selected.filter((item) => item.pantryCategory !== null);
      const fridgeBound = selected.filter((item) => item.pantryCategory === null);
      if (pantryBound.length > 0) {
        addPantryItems(
          pantryBound.map((item) => ({
            name: item.name,
            [sourceLanguageField]: item.name,
            category: item.pantryCategory!,
            active: true,
          }))
        );
      }
      if (fridgeBound.length > 0) {
        addInventoryItems(fridgeBound);
      }
    }
    // Asistanla eklenen adlar aktif dilde üretilir — karşı dil karşılıkları
    // ARKA PLANDA tamamlanır (dil değişiminde anında takas için; bkz.
    // src/i18n/inventoryI18n.ts). Hata akışı bozmaz, ekleme çoktan bitti.
    void backfillInventoryTranslations('tr').catch(() => {});
    void backfillInventoryTranslations('en').catch(() => {});
    void backfillPantryTranslations('tr').catch(() => {});
    void backfillPantryTranslations('en').catch(() => {});
    setIsDone(true);
    setTimeout(() => router.back(), 900);
  }

  function handleMicPress() {
    Alert.alert(t('assistant.voiceSoonTitle'), t('assistant.voiceSoonBody'));
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Üst bar — referans 583-588: yatay padding 20, gap 12; kapat 40×40
            beyaz daire + X 20 forest; başlık Newsreader 500 22px. */}
        <View className="flex-row items-center gap-3 px-5 pt-3">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-white active:scale-95"
            style={CLOSE_SHADOW}>
            <Ionicons name="close" size={20} color={colors.forest} />
          </Pressable>
          <Text className="font-serif text-[22px] text-forest">{t('assistant.title')}</Text>
        </View>

        {isDone ? (
          // Kısa başarı durumu — ardından otomatik geri dönülür.
          <View className="flex-1 items-center justify-center px-8">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-softgreen-bg">
              <Ionicons name="checkmark" size={30} color={colors.forest} />
            </View>
            <Text className="mt-4 font-serif text-xl text-ink">
              {t('assistant.addedTitle', { count: selectedCount })}
            </Text>
            <Text className="mt-1 font-sans text-sm text-muted">
              {targetMode === 'pantry' ? t('assistant.addedToPantry') : t('assistant.addedToKitchen')}
            </Text>
          </View>
        ) : (
          <>
            {/* Orta blok ekranın ~%38'ine sabit (referans 591: top 38%) —
                chip'ler gelince de yerinde kalır, yukarı zıplamaz. */}
            <View style={{ flex: 38 }} />

            <View className="px-5">
              {/* ✦ kutusu 54×54 r16 bg #DCEEE3, mb 14; başlık 500 21px
                  Newsreader; alt metin 400 12.5px, üstten 5 (592-596). */}
              <View className="mb-5 items-center">
                <View className="mb-[14px] h-[54px] w-[54px] items-center justify-center rounded-2xl bg-softgreen-bg">
                  <Text className="text-[22px] text-forest">✦</Text>
                </View>
                <Text className="font-serif text-[21px] text-forest">{t('assistant.prompt')}</Text>
                <Text className="mt-[5px] font-sans text-[12.5px] text-muted">
                  {t('assistant.promptHint')}
                </Text>
              </View>

              {/* Arama barı — referans 597-603: beyaz r18, padding 8/8/8/16,
                  çerçeve 1px rgba(31,74,61,.08); mic 38×38 idle #EFF3EC. */}
              <View
                className="flex-row items-center gap-2 rounded-[18px] bg-white py-2 pl-4 pr-2"
                style={[SEARCH_BAR_SHADOW, { borderWidth: 1, borderColor: 'rgba(31,74,61,0.08)' }]}>
                <Ionicons name="search" size={20} color={colors.muted} />
                <TextInput
                  value={text}
                  onChangeText={setText}
                  onSubmitEditing={handleParse}
                  editable={!isParsing}
                  placeholder={t('assistant.inputPlaceholder')}
                  placeholderTextColor={colors.muted2}
                  returnKeyType="done"
                  className="flex-1 py-1 font-sans text-[15px] text-ink"
                />
                <Pressable
                  onPress={handleMicPress}
                  className="h-[38px] w-[38px] items-center justify-center rounded-full bg-pillbg active:scale-95">
                  <Ionicons name="mic-outline" size={18} color={colors.forest} />
                </Pressable>
              </View>
            </View>

            {/* Ayrıştırılanlar barın altında aşağı doğru büyür (607-621). */}
            <View style={{ flex: 62 }}>
              {isParsing ? (
                <View className="flex-row items-center justify-center gap-2 pt-4">
                  <ActivityIndicator size="small" color={colors.forest} />
                  <Text className="font-sans text-xs text-muted">{t('assistant.parsing')}</Text>
                </View>
              ) : null}

              {hasParsed ? (
                <ScrollView
                  contentContainerClassName="px-5 pt-[18px] pb-4"
                  keyboardShouldPersistTaps="handled">
                  <SectionLabel className="mb-[14px] text-center">
                    {t('assistant.recognizedLabel')}
                  </SectionLabel>
                  <View className="flex-row flex-wrap justify-center gap-[9px]">
                    {parsedItems.map((item) => (
                      <Chip
                        key={item.id}
                        label={chipLabel(item)}
                        selected={selectedIds.has(item.id)}
                        onPress={() => toggleItem(item.id)}
                        showCheck
                      />
                    ))}
                  </View>
                </ScrollView>
              ) : null}
            </View>

            {/* Sabit alt CTA — referans 624-626: padding 16px 20px 34px. */}
            {hasParsed ? (
              <View className="px-5 pb-[34px] pt-4">
                <PrimaryButton
                  size="cta"
                  label={
                    selectedCount > 0
                      ? t('assistant.addSelected', { count: selectedCount })
                      : t('assistant.selectAtLeastOne')
                  }
                  onPress={handleAdd}
                  disabled={selectedCount === 0}
                />
              </View>
            ) : null}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
