import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { SAMPLE_INSTAGRAM_RECIPE, SAMPLE_WEB_RECIPE } from '@/lib/recipes/sample-imports';
import { useCookbookStore } from '@/store/cookbookStore';
import type { Recipe } from '@/types/recipe';

import { AddRecipeMenuSheet } from './AddRecipeMenuSheet';
import { InstagramEduSheet } from './InstagramEduSheet';
import { InstagramFeedScreen } from './InstagramFeedScreen';
import { InstagramLaunchScreen } from './InstagramLaunchScreen';
import { SocialPlatformSheet } from './SocialPlatformSheet';
import { WebImportScreen } from './WebImportScreen';

export interface ImportFlowProps {
  visible: boolean;
  onClose: () => void;
}

/** Akış adımları — referans addFlow state'inin karşılığı (Mutfagim.dc.html 1061-1077). */
type ImportFlowStep = 'menu' | 'social' | 'ig-edu' | 'ig-launch' | 'ig-feed' | 'web';

/** Launch ekranından feed taklidine geçiş gecikmesi — referans launchInstagram: 1900ms. */
const IG_LAUNCH_DELAY_MS = 1900;

/**
 * "+" Tarif Ekle akışının host bileşeni — visible olunca menü sheet'i
 * açılır; iç state machine adımlar arasında gezdirir. RN'de iç içe Modal
 * sorun çıkardığı için her adım AYRI bir Modal/BottomSheet'tir ve tek
 * seferde yalnızca biri görünür. Import başarılı olunca tarif kalıcı
 * listeye yazılır (cookbookStore.importRecipe), akış kapanır ve detay
 * ekranına yönlendirilir.
 */
export default function ImportFlow({ visible, onClose }: ImportFlowProps) {
  const [step, setStep] = useState<ImportFlowStep>('menu');
  const [igPage, setIgPage] = useState(0);
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Akış kapanınca state sıfırlanır (referans closeFlow: addFlow null, igPage 0).
  useEffect(() => {
    if (!visible) {
      setStep('menu');
      setIgPage(0);
    }
  }, [visible]);

  // Launch ekranı görünür olunca 1900ms sonra otomatik feed'e geç;
  // adım değişirse/kapanırsa/unmount olursa timer temizlenir.
  useEffect(() => {
    if (visible && step === 'ig-launch') {
      launchTimer.current = setTimeout(() => setStep('ig-feed'), IG_LAUNCH_DELAY_MS);
      return () => {
        if (launchTimer.current) {
          clearTimeout(launchTimer.current);
          launchTimer.current = null;
        }
      };
    }
  }, [visible, step]);

  /** İçe aktarma (referans importRecipe): store'a yaz → kapat → detayı aç. */
  function handleImport(recipe: Recipe) {
    useCookbookStore.getState().importRecipe(recipe);
    onClose();
    router.push(`/recipe/${recipe.id}`);
  }

  /** Fotoğraftan: akışı kapatıp tam ekran kamerayı tarif modunda aç. */
  function handlePhoto() {
    onClose();
    router.push('/capture/camera?mode=recipe');
  }

  return (
    <>
      <AddRecipeMenuSheet
        visible={visible && step === 'menu'}
        onClose={onClose}
        onSocial={() => setStep('social')}
        onWeb={() => setStep('web')}
        onPhoto={handlePhoto}
      />
      <SocialPlatformSheet
        visible={visible && step === 'social'}
        onClose={onClose}
        onBack={() => setStep('menu')}
        onPickPlatform={() => setStep('ig-edu')}
      />
      <InstagramEduSheet
        visible={visible && step === 'ig-edu'}
        onClose={onClose}
        page={igPage}
        onPrev={() => setIgPage((page) => Math.max(0, page - 1))}
        onNext={() => setIgPage((page) => Math.min(2, page + 1))}
        onLaunch={() => setStep('ig-launch')}
        onImportSample={() => handleImport(SAMPLE_INSTAGRAM_RECIPE)}
      />
      <InstagramLaunchScreen visible={visible && step === 'ig-launch'} onClose={onClose} />
      <InstagramFeedScreen
        visible={visible && step === 'ig-feed'}
        onClose={onClose}
        onImport={() => handleImport(SAMPLE_INSTAGRAM_RECIPE)}
      />
      <WebImportScreen
        visible={visible && step === 'web'}
        onClose={onClose}
        onImport={() => handleImport(SAMPLE_WEB_RECIPE)}
      />
    </>
  );
}
