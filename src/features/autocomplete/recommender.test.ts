import { describe, expect, it } from 'vitest';
import { loadHospitalPhrases } from './hospital';
import { createChosungWord, HOSPITAL_SOURCE } from './models';
import { getSuggestions, initializeRecommender, SuggestionEngine } from './recommender';
import { ChosungTrie, loadChosungWords, MAX_CACHED_CANDIDATES } from './trie';

describe('Python ChosungTrie/recommender.py 포팅', () => {
  it('원본 일반 단어 26,795개와 병원 표현 79개를 그대로 로드한다', () => {
    expect(loadChosungWords()).toHaveLength(26_795);
    expect(loadHospitalPhrases()).toHaveLength(79);

    const engine = initializeRecommender();
    expect(engine.available).toBe(true);
    expect(engine.wordfreqCount).toBe(26_795);
    expect(engine.hospitalCount).toBe(79);
  });

  it('원본의 알려진 초성 조회 결과를 반환한다', () => {
    expect(getSuggestions('ㄴ')).toEqual(['너무 아파요', '네', '내일 봬요']);
    expect(getSuggestions('ㄴㅁ')).toEqual(['너무 아파요', '너무', '나무']);
  });

  it('병원 표현을 우선하고 같은 우선순위는 CSV 순서를 유지한다', () => {
    expect(getSuggestions('ㄱ')).toEqual([
      '간호사 불러주세요',
      '가래가 막혔어요',
      '가래를 빼주세요',
    ]);
  });

  it('노드 캐시는 최대 20개, 공개 API는 최대 3개로 제한한다', () => {
    const engine = initializeRecommender();
    expect(engine.trie?.maxCachedCandidates).toBe(MAX_CACHED_CANDIDATES);
    expect(engine.trie?.query('ㄱ', 100)).toHaveLength(MAX_CACHED_CANDIDATES);
    expect(engine.getSuggestions('ㄱ', 100)).toHaveLength(3);
    expect(engine.getSuggestions('ㄱ', 0)).toEqual([]);
  });

  it('같은 표시 문자열은 병원 항목을 남기고 일반 후보는 빈도 rank 순서를 유지한다', () => {
    const generalNe = createChosungWord({ word: '네', chosung: 'ㄴ', freq: 1, rank: 1 });
    const generalNa = createChosungWord({ word: '나', chosung: 'ㄴ', freq: 0.5, rank: 2 });
    const hospitalNe = createChosungWord({
      word: '네',
      chosung: 'ㄴ',
      freq: 0,
      rank: 1,
      source: HOSPITAL_SOURCE,
      priority: 300,
      category: 'communication',
      context: 'patient_staff',
    });
    const trie = ChosungTrie.fromWords([generalNe, generalNa, hospitalNe]);
    const engine = new SuggestionEngine(trie, 0, 2, 1);

    expect(trie.query('ㄴ').map((item) => [item.word, item.source])).toEqual([
      ['네', HOSPITAL_SOURCE],
      ['나', 'wordfreq'],
    ]);
    expect(engine.getSuggestions('ㄴ')).toEqual(['네', '나']);
  });

  it('초기화된 Trie를 재사용하며 개별 조회가 100ms 이내다', () => {
    const first = initializeRecommender();
    expect(initializeRecommender()).toBe(first);

    const startedAt = performance.now();
    for (let index = 0; index < 1_000; index += 1) getSuggestions('ㄴㅁ');
    const averageLookupMs = (performance.now() - startedAt) / 1_000;
    console.info(
      `[autocomplete-performance] initialization=${first.initializationMs.toFixed(2)}ms average_lookup=${averageLookupMs.toFixed(4)}ms`,
    );
    expect(averageLookupMs).toBeLessThan(100);
  });
});
