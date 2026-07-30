import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from '@/components/ui';
import { cookbookDisplayName } from '@/src/i18n/labels';
import { useCookbookStore } from '@/store/cookbookStore';
import { trackRecipeSaved } from '@/tracking';
import type { Recipe } from '@/types/recipe';

export interface CookbookPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  recipe: Recipe;
}

/** Defter satırı gölgesi — referans: 0 2px 8px -4px rgba(31,74,61,.12). */
const ROW_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 4,
  elevation: 2,
} as const;

/**
 * "Deftere ekle" sheet'i — BİREBİR referans (COOKBOOK PICKER SHEET):
 * serif 22 forest başlık + 12.5 muted alt metin; beyaz defter satırları
 * (radius 15, padding 14/16) solda 24×24 checkbox (seçiliyse forest zemin +
 * beyaz check, değilse 2px #CBD3CD çerçeve), sağda "{N} tarif" sayacı.
 * Satıra dokunmak tarifi o defterde aç/kapa yapar; "Bitti" sheet'i kapatır.
 */
export default function CookbookPickerSheet({ visible, onClose, recipe }: CookbookPickerSheetProps) {
  const { t } = useTranslation();
  const cookbooks = useCookbookStore((state) => state.cookbooks);
  const toggleRecipeInCookbook = useCookbookStore((state) => state.toggleRecipeInCookbook);
  const importedRecipes = useCookbookStore((state) => state.importedRecipes);

  const handleToggle = (cookbookId: string, wasSelected: boolean) => {
    // Analitik: yalnız EKLEME yönünde (çıkarma recipe.saved sayılmaz).
    if (!wasSelected) {
      const isImported = importedRecipes.some((entry) => entry.id === recipe.id);
      trackRecipeSaved(isImported ? 'imported' : 'generated');
    }
    toggleRecipeInCookbook(cookbookId, recipe);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mb-1 font-serif text-[22px] text-forest">{t('cookbooks.pickerTitle')}</Text>
      <Text className="mb-4 font-sans text-[12.5px] text-muted">
        {t('cookbooks.pickerSubtitle')}
      </Text>

      <View className="mb-3.5 gap-[9px]">
        {cookbooks.map((cookbook) => {
          const selected = cookbook.recipeIds.includes(recipe.id);
          const displayName = cookbookDisplayName(cookbook);
          return (
            <Pressable
              key={cookbook.id}
              accessibilityRole="button"
              accessibilityLabel={
                selected
                  ? t('cookbooks.removeFromA11y', { name: displayName })
                  : t('cookbooks.addToA11y', { name: displayName })
              }
              onPress={() => handleToggle(cookbook.id, selected)}
              className="flex-row items-center gap-3 rounded-[15px] bg-white px-4 py-3.5 active:scale-[0.98]"
              style={ROW_SHADOW}>
              <View
                className={`h-6 w-6 items-center justify-center rounded-lg ${
                  selected ? 'bg-forest' : 'bg-white'
                }`}
                style={selected ? undefined : { borderWidth: 2, borderColor: '#CBD3CD' }}>
                {selected && <Ionicons name="checkmark" size={13} color="white" />}
              </View>
              <Text className="flex-1 font-sans-semibold text-[14px] text-ink">
                {displayName}
              </Text>
              <Text className="font-sans-medium text-[11px] text-muted">
                {t('cookbooks.recipeCount', { count: cookbook.recipeIds.length })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('cookbooks.doneA11y')}
        onPress={onClose}
        className="items-center rounded-2xl bg-forest p-[15px] active:scale-[0.98]">
        <Text className="font-sans-semibold text-[15px] text-white">{t('common.done')}</Text>
      </Pressable>
    </BottomSheet>
  );
}
