import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BottomSheet, PrimaryButton } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useCookbookStore } from '@/store/cookbookStore';
import { showToast } from '@/store/toastStore';

export interface CreateCookbookSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Geri butonu → giriş sheet'i (Add a Recipe / Add a Cookbook). */
  onBack: () => void;
}

/**
 * "Add a Cookbook" sheet'i — kısa ad girişi + oluştur butonu. Oluşturulan
 * defter Kayıtlı sekmesindeki Defterlerim grid'ine düşer (cookbookStore).
 */
export function CreateCookbookSheet({ visible, onClose, onBack }: CreateCookbookSheetProps) {
  const [name, setName] = useState('');

  // Sheet kapanınca taslak sıfırlanır (bir sonraki açılış temiz başlasın).
  useEffect(() => {
    if (!visible) setName('');
  }, [visible]);

  const canCreate = name.trim().length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    useCookbookStore.getState().createCookbook(name);
    showToast(`"${name.trim()}" defteri oluşturuldu`);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="mb-4 flex-row items-center gap-3">
        <Pressable
          onPress={onBack}
          accessibilityLabel="Geri"
          className="items-center justify-center rounded-full bg-sand active:scale-95"
          style={{ width: 34, height: 34 }}>
          <Ionicons name="chevron-back" size={17} color={colors.forest} />
        </Pressable>
        <Text className="font-serif text-[20px] text-ink">Add a Cookbook</Text>
      </View>

      <View
        className="mb-4 rounded-[18px] bg-white px-4 py-1"
        style={{ borderWidth: 1, borderColor: 'rgba(31,74,61,0.08)' }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Defter adı — örn. Tatlılar"
          placeholderTextColor={colors.muted2}
          className="py-3 font-sans text-[15px] text-ink"
          returnKeyType="done"
          onSubmitEditing={handleCreate}
          accessibilityLabel="Defter adı"
          autoFocus
        />
      </View>

      <PrimaryButton
        size="cta"
        label="Defteri oluştur"
        onPress={handleCreate}
        disabled={!canCreate}
      />
    </BottomSheet>
  );
}
