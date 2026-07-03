import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import InventoryList from '@/components/inventory/InventoryList';
import { extractInventoryFromImages, InventoryVisionError } from '@/lib/claude/extractInventoryFromImages';
import { extractVideoFramesAsBase64 } from '@/lib/media/extractVideoFrames';
import { useInventoryStore } from '@/store/inventoryStore';

export default function MutfagimScreen() {
  const items = useInventoryStore((state) => state.items);
  const addItems = useInventoryStore((state) => state.addItems);
  const incrementQty = useInventoryStore((state) => state.incrementQty);
  const decrementQty = useInventoryStore((state) => state.decrementQty);
  const removeItem = useInventoryStore((state) => state.removeItem);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handlePickAndAnalyze() {
    setErrorMessage(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage('Galeriye erişim izni gerekli.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      base64: true,
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    setIsAnalyzing(true);

    try {
      let images: string[];

      if (asset.type === 'video') {
        const frames = await extractVideoFramesAsBase64(asset.uri);
        if (frames.length === 0) {
          throw new InventoryVisionError('Video işlenemedi, tekrar deneyin.');
        }
        images = frames;
      } else {
        if (!asset.base64) {
          throw new InventoryVisionError('Fotoğraf okunamadı, tekrar deneyin.');
        }
        images = [asset.base64];
      }

      const extractedItems = await extractInventoryFromImages(images);
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
    </SafeAreaView>
  );
}
