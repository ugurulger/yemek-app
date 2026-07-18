import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { Chip, SectionLabel } from '@/components/ui';
import { useRecipeStore } from '@/store/recipeStore';
import { PREFERENCE_SECTIONS, type PreferenceSectionId } from '@/types/preferences';

interface PreferencesScreenProps {
  /** "İleri" — tercihler store'a zaten yazılmış olur, üretimi başlatır. */
  onNext: () => void;
}

/**
 * "İleri" CTA gölgesi — PrimaryButton size='cta' ile birebir aynı değerler
 * (referans: 0 12px 26px -10px rgba(31,74,61,.6)). Buton, referansta metnin
 * SAĞINDA arrow-forward ikonu taşıdığı için (PrimaryButton ikonu solda
 * render eder) aynı değerlerle yerel kurulur.
 */
const CTA_SHADOW = {
  shadowColor: '#1F4A3D',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.6,
  shadowRadius: 13,
  elevation: 6,
} as const;

/**
 * Tek ekranlık tarif tercihi — birebir referans (Mutfagim.dc.html SCREEN 2,
 * tercih ekranı): padding 8px 20px 176px; eyebrow 400 13px muted ls .3;
 * h1 Newsreader 500 31px forest (margin 3px üst 5px alt); alt metin 400
 * 12.5px muted mb 24; kategori blokları arası 22px, etiket altı 11px,
 * chip'ler wrap gap 8. "İleri" butonu ekran altına sabit (konteyner padding
 * 12px 20px 14px). Route DEĞİL: `app/(tabs)/recipes.tsx` içinde koşullu
 * render edilir. Seçimler anında `recipeStore.preferences`'a yazılır
 * (kalıcı) ve üretim parmak izine girer.
 */
export default function PreferencesScreen({ onNext }: PreferencesScreenProps) {
  const { t } = useTranslation();
  const preferences = useRecipeStore((state) => state.preferences);
  const setPreferences = useRecipeStore((state) => state.setPreferences);

  function toggleOption(sectionId: PreferenceSectionId, option: string) {
    const current = preferences[sectionId];
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    setPreferences({ ...preferences, [sectionId]: next });
  }

  return (
    <View className="flex-1 bg-cream">
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 176 }}
        showsVerticalScrollIndicator={false}>
        <Text className="font-sans text-[13px] text-muted" style={{ letterSpacing: 0.3 }}>
          {t('preferences.eyebrow')}
        </Text>
        <Text className="mb-[5px] mt-[3px] font-serif text-[31px] leading-[35px] text-forest">
          {t('preferences.title')}
        </Text>
        <Text className="mb-6 font-sans text-[12.5px] text-muted">
          {t('preferences.hint')}
        </Text>

        <View className="gap-[22px]">
          {PREFERENCE_SECTIONS.map((section) => (
            <View key={section.id}>
              <SectionLabel className="mb-[11px]">
                {t(`preferences.sections.${section.id}`)}
              </SectionLabel>
              <View className="flex-row flex-wrap gap-2">
                {section.options.map((option) => (
                  <Chip
                    key={option}
                    label={t(`preferences.options.${option}`)}
                    selected={preferences[section.id].includes(option)}
                    onPress={() => toggleOption(section.id, option)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Ekran altına sabit tam genişlik "İleri" — konteyner padding
          12px 20px 14px (tab bar zaten ekran akışında, ek pay gerekmez). */}
      <View className="absolute inset-x-0 bottom-0 px-5 pb-3.5 pt-3">
        <Pressable
          accessibilityRole="button"
          onPress={onNext}
          className="w-full flex-row items-center justify-center rounded-[18px] bg-forest p-4 active:scale-95"
          style={CTA_SHADOW}>
          <Text className="font-sans-semibold text-[15px] text-white">{t('common.next')}</Text>
          <View className="ml-[9px]">
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </View>
        </Pressable>
      </View>
    </View>
  );
}
