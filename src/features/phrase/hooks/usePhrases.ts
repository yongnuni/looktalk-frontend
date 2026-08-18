import { useCallback, useEffect, useState } from 'react';
import {
  createPhrase,
  deletePhrase,
  getPhrases,
} from '../api/phrases';
import {
  MAX_PHRASES,
  usePhraseStore,
} from '../../../shared/stores/phraseStore';
import { prepareCurrentUserE2eeKey } from '../../../shared/api/e2eeKeys';
import {
  decryptMemo as decryptPhraseText,
  encryptMemo as encryptPhraseText,
} from '../../../shared/utils/e2ee';
import type { PhraseDto } from '../../../shared/types/backend';
import type { Phrase } from '../../../shared/types/mypage';

async function toPhrase(dto: PhraseDto, userId: string): Promise<Phrase> {
  let text = '복호화할 수 없는 문장입니다.';

  try {
    text = await decryptPhraseText(dto.encryptedPayload, userId);
  } catch (error) {
    console.error(`문장 복호화 실패 phraseId=${dto.phraseId}`, error);
  }

  return {
    id: dto.phraseId,
    text,
    category: dto.category,
    createdAt: dto.createdAt,
  };
}

/** 자주 쓰는 문장 관리 (E2EE 암호화, 서버 FIFO로 최대 {@link MAX_PHRASES}개 유지) */
export function usePhrases() {
  const phrases = usePhraseStore((state) => state.phrases);
  const setPhrases = usePhraseStore((state) => state.setPhrases);
  const addPhraseToStore = usePhraseStore((state) => state.addPhrase);
  const removePhraseFromStore = usePhraseStore((state) => state.removePhrase);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPhrases = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const key = await prepareCurrentUserE2eeKey();
        const data = await getPhrases();
        const decrypted = await Promise.all(
          data.map((dto) => toPhrase(dto, key.userId)),
        );

        if (isMounted) setPhrases(decrypted);
      } catch {
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadPhrases();

    return () => {
      isMounted = false;
    };
  }, [setPhrases]);

  const registerPhrase = useCallback(
    async (text: string) => {
      const trimmed = text.trim();

      if (!trimmed || isSaving) return;

      setIsSaving(true);

      try {
        const key = await prepareCurrentUserE2eeKey();
        const encryptedPayload = await encryptPhraseText(
          trimmed,
          key.publicKey,
          key.keyVersion,
        );

        const created = await createPhrase({
          category: null,
          encryptedPayload,
        });

        if (created.replacedPhraseId !== null) {
          removePhraseFromStore(created.replacedPhraseId);
        }

        addPhraseToStore({
          id: created.phraseId,
          text: trimmed,
          category: null,
          createdAt: created.createdAt,
        });
      } finally {
        setIsSaving(false);
      }
    },
    [addPhraseToStore, isSaving, removePhraseFromStore],
  );

  const removePhrase = useCallback(
    async (id: number) => {
      await deletePhrase(id);
      removePhraseFromStore(id);
    },
    [removePhraseFromStore],
  );

  return {
    phrases,
    maxPhrases: MAX_PHRASES,
    isLoading,
    hasError,
    isSaving,
    registerPhrase,
    removePhrase,
  };
}
