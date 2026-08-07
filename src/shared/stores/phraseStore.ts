import { create } from 'zustand';
import type { Phrase } from '../types/mypage';

/** 자주 쓰는 문장 최대 등록 개수 */
export const MAX_PHRASES = 3;

interface PhraseState {
  phrases: Phrase[];
  /** 최대 개수 초과 시 가장 오래된 문장부터 삭제 */
  addPhrase: (text: string) => void;
  removePhrase: (id: number) => void;
  clearPhrases: () => void;
}

export const usePhraseStore = create<PhraseState>((set) => ({
  phrases: [],

  addPhrase: (text) =>
    set((state) => {
      const next = [
        ...state.phrases,
        { id: Date.now(), text, createdAt: Date.now() },
      ];

      return { phrases: next.slice(-MAX_PHRASES) };
    }),

  removePhrase: (id) =>
    set((state) => ({
      phrases: state.phrases.filter((phrase) => phrase.id !== id),
    })),

  clearPhrases: () => set({ phrases: [] }),
}));
