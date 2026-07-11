import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Şefe Sor — tarife özel sohbet geçmişi (spec §5). Her tarif için ayrı
 * konuşma, tarif id'siyle saklanır; `askChef` çağrısına geçmişin tamamı
 * gönderilir (bkz. services/contracts.ts).
 */
export interface ChefChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

interface ChefChatState {
  /** recipeId → mesajlar (kronolojik). */
  chats: Record<string, ChefChatMessage[]>;
  addMessage: (recipeId: string, message: ChefChatMessage) => void;
  clearChat: (recipeId: string) => void;
}

export const useChefChatStore = create<ChefChatState>()(
  persist(
    (set) => ({
      chats: {},
      addMessage: (recipeId, message) =>
        set((state) => ({
          chats: {
            ...state.chats,
            [recipeId]: [...(state.chats[recipeId] ?? []), message],
          },
        })),
      clearChat: (recipeId) =>
        set((state) => {
          const { [recipeId]: _removed, ...rest } = state.chats;
          return { chats: rest };
        }),
    }),
    {
      name: 'yemek-app-chef-chats',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
