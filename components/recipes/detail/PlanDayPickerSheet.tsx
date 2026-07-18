import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from '@/components/ui';
import { buildCartMissingInput } from '@/lib/recipes/cart-helpers';
import { getAppLanguage } from '@/src/i18n';
import { expandInventoryForMatching, expandPantryForMatching } from '@/src/i18n/inventoryI18n';
import { useLocalizedRecipe } from '@/src/i18n/recipeI18n';
import { useCartStore } from '@/store/cartStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { usePantryStore } from '@/store/pantryStore';
import { PLAN_DAYS, usePlanStore, type PlanDay } from '@/store/planStore';
import { showToast } from '@/store/toastStore';
import type { Recipe } from '@/types/recipe';

export interface PlanDayPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  recipe: Recipe;
  /** Detay ekranındaki güncel kişi sayısı — plan kaydına aynen yazılır. */
  servings: number;
}

/** Gün satırı gölgesi — referans: 0 2px 8px -4px rgba(31,74,61,.12). */
const ROW_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 4,
  elevation: 2,
} as const;

/**
 * "Hangi güne?" sheet'i — BİREBİR referans (PLAN DAY PICKER SHEET):
 * serif 22 forest başlık + muted alt metin; 7 beyaz gün satırı (radius 15,
 * padding 14/16) solda gün adı, sağda "{N} öğün planlı" sayacı. Güne
 * dokunmak tarifi o günün planına ekler ve sheet'i kapatır.
 */
export default function PlanDayPickerSheet({
  visible,
  onClose,
  recipe,
  servings,
}: PlanDayPickerSheetProps) {
  const { t } = useTranslation();
  const plan = usePlanStore((state) => state.plan);
  const addToPlan = usePlanStore((state) => state.addToPlan);
  const inventoryItems = useInventoryStore((state) => state.items);
  const pantryItems = usePantryStore((state) => state.items);
  const syncRecipeMissing = useCartStore((state) => state.syncRecipeMissing);
  // Sepet kayıtlarının karşı dil adları için mevcut tarif çevirisi (İş 3c).
  const localizedRecipe = useLocalizedRecipe(recipe);

  const handleSelectDay = (day: PlanDay) => {
    addToPlan(day, {
      recipeId: recipe.id,
      name: recipe.name,
      kcal: recipe.kcal,
      emoji: recipe.emoji,
      meal: 'Akşam',
      servings,
    });
    // Plan → sepet otomasyonu (kullanıcı kararı): planlanan tarifin CANLI
    // eksikleri otomatik markete yazılır — manuel "sepete ekle" adımı yok.
    // syncRecipeMissing tarif bazlı DEĞİŞTİRDİĞİ için aynı tarif ikinci bir
    // güne planlansa da katkı bir kez sayılır; farklı tariflerin ortak
    // eksikleri market ekranında mergeCartEntries ile tek satırda toplanır.
    // Envanter/kiler İKİ DİLLİ ad varyantlarıyla genişletilir — rozet/detayla
    // aynı eşleştirme girdisi (İş 3c tutarlılık kuralı).
    const missing = buildCartMissingInput(
      recipe,
      servings,
      expandInventoryForMatching(inventoryItems),
      expandPantryForMatching(pantryItems),
      localizedRecipe !== recipe
        ? {
            language: getAppLanguage(),
            ingredientNames: localizedRecipe.ingredients.map((ingredient) => ingredient.name),
          }
        : undefined
    );
    if (missing.length > 0) {
      syncRecipeMissing(recipe.name, missing);
      showToast(t('plan.addedWithMissingToast'));
    } else {
      showToast(t('plan.addedToast'));
    }
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mb-1 font-serif text-[22px] text-forest">{t('plan.pickerTitle')}</Text>
      <Text className="mb-[18px] font-sans text-[13px] text-muted">
        {t('plan.pickerSubtitle')}
      </Text>

      <View className="gap-[9px]">
        {PLAN_DAYS.map((day) => (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={t('plan.addToDayA11y', { day: t(`data.day.${day}`) })}
            onPress={() => handleSelectDay(day)}
            className="flex-row items-center justify-between rounded-[15px] bg-white px-4 py-3.5 active:scale-[0.98]"
            style={ROW_SHADOW}>
            <Text className="font-sans-semibold text-[14px] text-ink">{t(`data.day.${day}`)}</Text>
            <Text className="font-sans-medium text-[11px] text-muted">
              {t('plan.mealsPlanned', { count: plan[day].length })}
            </Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
