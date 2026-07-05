import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

import InventoryList from '@/components/inventory/InventoryList';
import { extractInventory, InventoryVisionError } from '@/services/vision';
import { extractVideoFramesAsBase64 } from '@/lib/media/extractVideoFrames';
import { resizeImageToBase64 } from '@/lib/media/resizeImageToBase64';
import { useInventoryStore } from '@/store/inventoryStore';

// DENEYSEL: Gemini'nin native video girişini dener (bkz. services/vision/gemini-provider.ts).
// Kapalıyken davranış değişmez. Sadece Gemini aktifken anlamlıdır — Claude
// video kabul etmiyor (bkz. SKILL.md).
const NATIVE_VIDEO_ENABLED = process.env.EXPO_PUBLIC_GEMINI_NATIVE_VIDEO === 'true';

export default function MutfagimScreen() {
  const items = useInventoryStore((state) => state.items);
  const addItems = useInventoryStore((state) => state.addItems);
  const incrementQty = useInventoryStore((state) => state.incrementQty);
  const decrementQty = useInventoryStore((state) => state.decrementQty);
  const removeItem = useInventoryStore((state) => state.removeItem);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // DEBUG — kaldırılacak: Aşama 1 (gözlem) ham metnini görüntülemek için.
  const [observationText, setObservationText] = useState<string | null>(null);
  const [isObservationModalVisible, setIsObservationModalVisible] = useState(false);

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

    try {
      let extractedItems;

      if (asset.type === 'video' && NATIVE_VIDEO_ENABLED) {
        // DENEYSEL: kare çıkarmadan ham videoyu doğrudan gönder (bkz.
        // services/vision/gemini-provider.ts). Sadece Gemini aktifken çalışır.
        const videoFile = new File(asset.uri);
        const videoBase64 = await videoFile.base64();
        extractedItems = await extractInventory([], {
          video: { data: videoBase64, mimeType: 'video/mp4' },
          onObservation: setObservationText,
        });
      } else if (asset.type === 'video') {
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

      addItems(extractedItems);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bir şeyler ters gitti, tekrar deneyin.';
      setErrorMessage(message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const hasItems = items.length > 0;

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
        <View className="flex-1 px-5">
          <InventoryList
            items={items}
            onIncrement={incrementQty}
            onDecrement={decrementQty}
            onDelete={removeItem}
          />
        </View>
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
