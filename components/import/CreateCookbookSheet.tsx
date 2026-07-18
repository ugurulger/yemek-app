import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [name, setName] = useState('');

  // Sheet kapanınca taslak sıfırlanır (bir sonraki açılış temiz başlasın).
  useEffect(() => {
    if (!visible) setName('');
  }, [visible]);

  const canCreate = name.trim().length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    useCookbookStore.getState().createCookbook(name);
    showToast(t('cookbooks.createdToast', { name: name.trim() }));
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="mb-4 flex-row items-center gap-3">
        <Pressable
          onPress={onBack}
          accessibilityLabel={t('common.backA11y')}
          className="items-center justify-center rounded-full bg-sand active:scale-95"
          style={{ width: 34, height: 34 }}>
          <Ionicons name="chevron-back" size={17} color={colors.forest} />
        </Pressable>
        <Text className="font-serif text-[20px] text-ink">{t('importFlow.addCookbook')}</Text>
      </View>

      <View
        className="mb-4 rounded-[18px] bg-white px-4 py-1"
        style={{ borderWidth: 1, borderColor: 'rgba(31,74,61,0.08)' }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('cookbooks.namePlaceholder')}
          placeholderTextColor={colors.muted2}
          className="py-3 font-sans text-[15px] text-ink"
          returnKeyType="done"
          onSubmitEditing={handleCreate}
          accessibilityLabel={t('cookbooks.nameA11y')}
          autoFocus
        />
      </View>

      <PrimaryButton
        size="cta"
        label={t('cookbooks.createButton')}
        onPress={handleCreate}
        disabled={!canCreate}
      />
    </BottomSheet>
  );
}
