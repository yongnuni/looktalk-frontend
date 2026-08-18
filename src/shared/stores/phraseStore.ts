import { create } from 'zustand';
import type { Phrase } from '../types/mypage';

/** 자주 쓰는 문장 최대 등록 개수 (서버 FIFO 정책과 동일) */
export const MAX_PHRASES = 3;

interface PhraseState {
  phrases: Phrase[];
  setPhrases: (phrases: Phrase[]) => void;
  addPhrase: (phrase: Phrase) => void;
  updatePhrase: (id: number, patch: Partial<Pick<Phrase, 'text' | 'category'>>) => void;
  removePhrase: (id: number) => void;
  clearPhrases: () => void;
}

export const usePhraseStore = create<PhraseState>((set) => ({
  phrases: [],

  setPhrases: (phrases) => set({ phrases }),

  addPhrase: (phrase) =>
    set((state) => ({
      phrases: [phrase, ...state.phrases].slice(0, MAX_PHRASES),
    })),

  updatePhrase: (id, patch) =>
    set((state) => ({
      phrases: state.phrases.map((phrase) =>
        phrase.id === id ? { ...phrase, ...patch } : phrase,
      ),
    })),

  removePhrase: (id) =>
    set((state) => ({
      phrases: state.phrases.filter((phrase) => phrase.id !== id),
    })),

  clearPhrases: () => set({ phrases: [] }),
}));
