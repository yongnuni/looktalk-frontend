import { create } from 'zustand';
import { handleKeyAction } from '../../features/keyboard/utils/keyActionHandler';

interface InputState {
  text: string;
  setText: (text: string) => void;
  pressKey: (keyValue: string) => void;
  clearText: () => void;
}

export const useInputStore = create<InputState>((set, get) => ({
  text: '',

  setText: (text) => set({ text }),

  pressKey: (keyValue) => {
    const currentText = get().text;
    const nextText = handleKeyAction(currentText, keyValue);

    set({ text: nextText });
  },

  clearText: () => set({ text: '' }),
}));