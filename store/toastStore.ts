import { create } from 'zustand';

/**
 * Global toast (referans TOAST bloğu): koyu pill, ~1.9 sn sonra kendiliğinden
 * kaybolur. Host bileşeni app/_layout.tsx içinde monte edilir
 * (components/ui/Toast.tsx) — her ekrandan `showToast('...')` ile kullanılır.
 */
interface ToastState {
  message: string | null;
  show: (message: string) => void;
  clear: () => void;
}

const TOAST_DURATION_MS = 1900;

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>()((set) => ({
  message: null,
  show: (message) => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message });
    hideTimer = setTimeout(() => set({ message: null }), TOAST_DURATION_MS);
  },
  clear: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message: null });
  },
}));

export function showToast(message: string): void {
  useToastStore.getState().show(message);
}
