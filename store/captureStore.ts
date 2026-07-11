import { create } from 'zustand';

/**
 * Kamera ekranı ↔ Mutfağım köprüsü (spec §3). Tam ekran kamera rotası
 * (`app/capture/camera.tsx`) kaydı bitirince videoyu buraya bırakıp geri
 * döner; Mutfağım ekranı (`app/(tabs)/index.tsx`) bu state'i izleyip mevcut
 * video analiz akışını başlatır ve `clear` eder. Kalıcı DEĞİLDİR (persist yok).
 */
export interface PendingVideo {
  uri: string;
  mimeType?: string;
}

interface CaptureState {
  pendingVideo: PendingVideo | null;
  setPendingVideo: (video: PendingVideo) => void;
  clearPendingVideo: () => void;
}

export const useCaptureStore = create<CaptureState>()((set) => ({
  pendingVideo: null,
  setPendingVideo: (video) => set({ pendingVideo: video }),
  clearPendingVideo: () => set({ pendingVideo: null }),
}));
