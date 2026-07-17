import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import { SAMPLE_INSTAGRAM_RECIPE, SAMPLE_WEB_RECIPE } from '@/lib/recipes/sample-imports';
import { useCookbookStore } from '@/store/cookbookStore';
import type { Recipe } from '@/types/recipe';

import { AddEntrySheet } from './AddEntrySheet';
import { AddRecipeMenuSheet } from './AddRecipeMenuSheet';
import { CreateCookbookSheet } from './CreateCookbookSheet';
import { InstagramEduSheet } from './InstagramEduSheet';
import { InstagramLaunchScreen } from './InstagramLaunchScreen';
import { SocialPlatformSheet } from './SocialPlatformSheet';
import { WebImportScreen } from './WebImportScreen';

export interface ImportFlowProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Akış adımları — giriş referansı design/Tarif_ekle/IMG_8473.PNG
 * (Add a Recipe / Add a Cookbook), sonrası referans addFlow state'i.
 */
type ImportFlowStep = 'entry' | 'cookbook' | 'menu' | 'social' | 'ig-edu' | 'ig-launch' | 'web';

/** Launch ekranından Instagram deeplink'ine geçiş gecikmesi — referans 1900ms. */
const IG_LAUNCH_DELAY_MS = 1900;

/** Instagram deeplink'i; uygulama yüklü değilse web fallback (IMG_8480→8481). */
const INSTAGRAM_APP_URL = 'instagram://app';
const INSTAGRAM_WEB_URL = 'https://www.instagram.com';

/**
 * "+" Tarif Ekle akışının host bileşeni — visible olunca giriş sheet'i
 * (Add a Recipe / Add a Cookbook) açılır; iç state machine adımlar arasında
 * gezdirir. RN'de iç içe Modal sorun çıkardığı için her adım AYRI bir
 * Modal/BottomSheet'tir ve tek seferde yalnızca biri görünür. Import
 * başarılı olunca tarif kalıcı listeye yazılır (cookbookStore.importRecipe),
 * akış kapanır ve detay ekranına yönlendirilir.
 */
export default function ImportFlow({ visible, onClose }: ImportFlowProps) {
  const [step, setStep] = useState<ImportFlowStep>('entry');
  const [igPage, setIgPage] = useState(0);
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Akış kapanınca state sıfırlanır (referans closeFlow: addFlow null, igPage 0).
  useEffect(() => {
    if (!visible) {
      setStep('entry');
      setIgPage(0);
    }
  }, [visible]);

  // Launch ekranı 1900ms gösterilir, sonra GERÇEK Instagram açılır (deeplink;
  // uygulama yoksa web fallback) ve akış kapanır. Feed taklidi kaldırıldı —
  // referans akışın sonu gerçek Instagram'dır (IMG_8481).
  useEffect(() => {
    if (visible && step === 'ig-launch') {
      launchTimer.current = setTimeout(() => {
        Linking.openURL(INSTAGRAM_APP_URL)
          .catch(() => Linking.openURL(INSTAGRAM_WEB_URL))
          .catch(() => {
            // Web fallback bile açılamadıysa sessizce akışı kapatmak yeterli.
          })
          .finally(onClose);
      }, IG_LAUNCH_DELAY_MS);
      return () => {
        if (launchTimer.current) {
          clearTimeout(launchTimer.current);
          launchTimer.current = null;
        }
      };
    }
  }, [visible, step, onClose]);

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
      <AddEntrySheet
        visible={visible && step === 'entry'}
        onClose={onClose}
        onAddRecipe={() => setStep('menu')}
        onAddCookbook={() => setStep('cookbook')}
      />
      <CreateCookbookSheet
        visible={visible && step === 'cookbook'}
        onClose={onClose}
        onBack={() => setStep('entry')}
      />
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
      <WebImportScreen
        visible={visible && step === 'web'}
        onClose={onClose}
        onImport={() => handleImport(SAMPLE_WEB_RECIPE)}
      />
    </>
  );
}
