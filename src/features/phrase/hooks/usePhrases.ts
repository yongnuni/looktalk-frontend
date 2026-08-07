import {
  MAX_PHRASES,
  usePhraseStore,
} from '../../../shared/stores/phraseStore';

/**
 * 자주 쓰는 문장 관리.
 *
 * 실제로는 타이핑 화면에서 넘어온 문장을 등록하지만,
 * 해당 화면이 아직 없어 "문장 등록하기" 클릭 시 더미 문장을 넣어 동작만 확인한다.
 */
const DUMMY_PHRASES = [
  '물 주세요',
  '안녕하세요',
  '화장실 가고 싶어요',
  '아파요',
  '감사합니다',
];

export function usePhrases() {
  const phrases = usePhraseStore((state) => state.phrases);
  const addPhrase = usePhraseStore((state) => state.addPhrase);
  const removePhrase = usePhraseStore((state) => state.removePhrase);

  // TODO : 타이핑 화면 구현 후 실제 입력 문장을 인자로 받도록 교체
  const registerDummyPhrase = () => {
    const next = DUMMY_PHRASES[phrases.length % DUMMY_PHRASES.length];

    addPhrase(next);
  };

  return {
    phrases,
    maxPhrases: MAX_PHRASES,
    registerDummyPhrase,
    removePhrase,
  };
}
