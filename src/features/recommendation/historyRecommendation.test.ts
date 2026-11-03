import { describe, expect, it, vi } from 'vitest';
import {
  createEmptyRecommendationDashboard,
  getLatestMeasurementRows,
  loadAnalysisRecommendation,
  recommendFromHistory,
  RecommendationModelLoadError,
  toDashboardData,
  toMeasurementRows,
  type InputSessionResponseDto,
} from './historyRecommendation';
import type { MeasurementRow, RecommendationResult } from './engine/types';

let logSeq = 0;
function dto(overrides: Partial<InputSessionResponseDto> = {}): InputSessionResponseDto {
  logSeq += 1;
  return {
    logId: `log-${logSeq}`,
    calibrationId: 'cal-1',
    inputMethod: 'EYE_TRACKING',
    sessionType: 'CALIBRATION_TEST',
    keyboardLayout: 'QWERTY',
    typoRate: 0,
    inputSpeed: 4,
    recognitionAccuracy: null,
    inputStability: null,
    sessionAt: '2026-11-03T10:00:00Z',
    ...overrides,
  };
}

/** 한 번의 측정(calibrationId)에 세 방식 행. 값은 초 단위 입력 시간 → 분당 음절 수. */
function measurement(
  calibrationId: string,
  sessionAt: string,
  seconds: { gaze?: number; blink?: number; mouth?: number },
  typo: { gaze?: number; blink?: number; mouth?: number } = {},
): InputSessionResponseDto[] {
  const entries = [
    ['EYE_TRACKING', seconds.gaze, typo.gaze],
    ['BLINK', seconds.blink, typo.blink],
    ['MOUTH', seconds.mouth, typo.mouth],
  ] as const;
  return entries
    .filter(([, s]) => s !== undefined)
    .map(([inputMethod, s, t]) =>
      dto({ calibrationId, inputMethod, sessionAt, inputSpeed: 60 / (s as number), typoRate: t ?? 0 }),
    );
}

describe('toMeasurementRows — API 응답 → 모델 MeasurementRow', () => {
  it('유효한 CALIBRATION_TEST 행을 calibrationId와 함께 그대로 변환한다', () => {
    expect(toMeasurementRows([dto({ inputSpeed: 2.6374, typoRate: 0.5 })])).toEqual([
      {
        calibrationId: 'cal-1',
        inputMethod: 'EYE_TRACKING',
        inputSpeed: 2.6374,
        typoRate: 0.5,
        sessionAt: '2026-11-03T10:00:00Z',
      },
    ]);
  });

  it('sessionAt·calibrationId·방식·단위가 유효하지 않은 행과 NORMAL_USE 행을 제외한다', () => {
    const rows = toMeasurementRows([
      dto({ sessionAt: null }),
      dto({ sessionAt: 'not-a-date' }),
      dto({ calibrationId: null }),
      dto({ calibrationId: '  ' }),
      dto({ inputMethod: 'GAZE' }),
      dto({ inputSpeed: null }),
      dto({ inputSpeed: 0 }),
      dto({ inputSpeed: Number.POSITIVE_INFINITY }),
      dto({ typoRate: null }),
      dto({ typoRate: -0.1 }),
      dto({ typoRate: 12 }), // 백분율로 저장된 값
      dto({ sessionType: 'NORMAL_USE' }),
      dto({ logId: 'kept' }),
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe('getLatestMeasurementRows — 최신 측정 그룹 추출', () => {
  it('가장 늦은 calibrationId 그룹의 방식별 행을 반환한다', () => {
    const rows = toMeasurementRows([
      ...measurement('old', '2026-11-01T00:00:00Z', { gaze: 10, blink: 20, mouth: 30 }),
      ...measurement('new', '2026-11-03T00:00:00Z', { gaze: 30, mouth: 10 }),
    ]);
    const latest = getLatestMeasurementRows(rows);
    expect(latest.map((row) => row.calibrationId)).toEqual(['new', 'new']);
    expect(latest.map((row) => row.inputMethod).sort()).toEqual(['EYE_TRACKING', 'MOUTH']);
  });

  it('같은 calibrationId·방식이 중복되면 가장 늦게 저장된 행만 남긴다', () => {
    const rows: MeasurementRow[] = [
      { calibrationId: 'c', inputMethod: 'BLINK', inputSpeed: 1, typoRate: 0, sessionAt: '2026-11-03T00:00:00Z' },
      { calibrationId: 'c', inputMethod: 'BLINK', inputSpeed: 3, typoRate: 0, sessionAt: '2026-11-03T00:00:05Z' },
    ];
    expect(getLatestMeasurementRows(rows)).toEqual([rows[1]]);
  });
});

describe('toDashboardData — RecommendationResult → RecommendationDashboardData', () => {
  it('enum을 화면 id로 매핑하고 최신 측정의 원시 inputSpeed를 채운다', () => {
    const result: RecommendationResult = {
      recommendedMethod: 'MOUTH',
      measuredAt: '2026-11-03T00:00:00.000Z',
      engine: 'model',
      methods: [
        { method: 'EYE_TRACKING', score: 20, present: true, typoRatePercent: 50, speedPercent: 50 },
        { method: 'BLINK', score: 5, present: false, typoRatePercent: null, speedPercent: null },
        { method: 'MOUTH', score: 75, present: true, typoRatePercent: 0, speedPercent: 100 },
      ],
    };
    const latest: MeasurementRow[] = [
      { calibrationId: 'c', inputMethod: 'EYE_TRACKING', inputSpeed: 2, typoRate: 0.5, sessionAt: '2026-11-03T00:00:00Z' },
      { calibrationId: 'c', inputMethod: 'MOUTH', inputSpeed: 4, typoRate: 0, sessionAt: '2026-11-03T00:00:00Z' },
    ];

    expect(toDashboardData(result, latest)).toEqual({
      measuredAt: '2026-11-03T00:00:00.000Z',
      engine: 'model',
      recommendedMethod: 'mouth',
      methods: [
        { id: 'gaze', label: '시선', description: '화면을 응시하여 입력', score: 20, present: true, typoRatePercent: 50, inputSpeed: 2 },
        { id: 'blink', label: '눈 깜빡임', description: '눈을 깜빡여 입력', score: null, present: false, typoRatePercent: null, inputSpeed: null },
        { id: 'mouth', label: '입 움직임', description: '입 움직임으로 입력', score: 75, present: true, typoRatePercent: 0, inputSpeed: 4 },
      ],
    });
  });

  it('추천이 없으면 recommendedMethod는 null이다', () => {
    const result: RecommendationResult = {
      recommendedMethod: null,
      measuredAt: null,
      engine: 'model',
      methods: [],
    };
    expect(toDashboardData(result, []).recommendedMethod).toBeNull();
  });
});

describe('recommendFromHistory — 실제 LightGBM 엔진', () => {
  it('누적 이력으로 모델 추천을 계산하고 최신 측정 값을 표시한다', async () => {
    const data = await recommendFromHistory([
      ...measurement('old', '2026-11-01T00:00:00Z', { gaze: 40, blink: 15, mouth: 40 }),
      ...measurement('new', '2026-11-03T00:00:00Z', { gaze: 15, blink: 40, mouth: 40 }),
    ]);

    expect(data.engine).toBe('model');
    expect(data.recommendedMethod).toBe('gaze');
    expect(data.measuredAt).toBe('2026-11-03T00:00:00.000Z');
    expect(data.methods.map((method) => method.id)).toEqual(['gaze', 'blink', 'mouth']);
    expect(data.methods.reduce((sum, method) => sum + (method.score ?? 0), 0)).toBe(100);
    expect(data.methods[0].inputSpeed).toBeCloseTo(4); // 60 / 15초 → 분당 4음절(최신 측정)
    expect(data.methods[1].inputSpeed).toBeCloseTo(1.5);
  });

  it('API 응답에 같은 calibrationId 행이 중복돼도 결과가 같다', async () => {
    const rows = measurement('c', '2026-11-03T00:00:00Z', { gaze: 15, blink: 40, mouth: 40 });
    expect(await recommendFromHistory([...rows, ...rows])).toEqual(await recommendFromHistory(rows));
  });

  it('최신 측정에서 생략한 방식은 추천하지 않고 present=false로 표시한다', async () => {
    const data = await recommendFromHistory(
      measurement('c', '2026-11-03T00:00:00Z', { gaze: 40, mouth: 30 }),
    );
    expect(data.recommendedMethod).not.toBe('blink');
    expect(data.methods[1]).toMatchObject({ id: 'blink', present: false, score: null, inputSpeed: null });
  });

  it('유효한 이력이 없으면 모델을 불러오지 않고 빈 결과를 반환한다', async () => {
    const loadEngine = vi.fn();
    expect(await recommendFromHistory([], { loadEngine })).toEqual(createEmptyRecommendationDashboard());
    expect(await recommendFromHistory([dto({ sessionAt: null })], { loadEngine })).toEqual(
      createEmptyRecommendationDashboard(),
    );
    expect(loadEngine).not.toHaveBeenCalled();
  });

  it('모델 모듈 로딩에 실패하면 RecommendationModelLoadError를 던진다', async () => {
    const loadEngine = vi.fn(() => Promise.reject(new Error('chunk load failed')));
    await expect(recommendFromHistory([dto()], { loadEngine })).rejects.toBeInstanceOf(
      RecommendationModelLoadError,
    );
  });
});

describe('loadAnalysisRecommendation — /analysis 상태 구분', () => {
  const rows = measurement('c', '2026-11-03T00:00:00Z', { gaze: 15, blink: 40, mouth: 40 });

  it('조회 성공 + 이력 있음 → ready', async () => {
    const state = await loadAnalysisRecommendation({ fetchRows: async () => rows });
    expect(state.status).toBe('ready');
    expect(state.status === 'ready' && state.data.recommendedMethod).toBe('gaze');
  });

  it('조회 실패 → api-error', async () => {
    const state = await loadAnalysisRecommendation({
      fetchRows: () => Promise.reject(new Error('500')),
    });
    expect(state).toEqual({ status: 'api-error' });
  });

  it('이력 없음 → empty (임시 추천 데이터를 쓰지 않음)', async () => {
    expect(await loadAnalysisRecommendation({ fetchRows: async () => [] })).toEqual({ status: 'empty' });
  });

  it('모델 로딩 실패 → model-error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const state = await loadAnalysisRecommendation({
      fetchRows: async () => rows,
      loadEngine: () => Promise.reject(new Error('chunk load failed')),
    });
    expect(state).toEqual({ status: 'model-error' });
    errorSpy.mockRestore();
  });
});
