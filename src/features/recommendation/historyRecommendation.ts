/**
 * B. 누적 측정 이력 기반 LightGBM 추천 — `/analysis` 전용 어댑터.
 *
 * - 캘리브레이션 직후 추천(A, `analysis/utils/recommend.ts`)과 계산 로직을 공유하지 않는다.
 *   UI 타입(`RecommendationDashboardData`)만 공유한다.
 * - 2.6MB 모델 JSON이 메인 번들에 들어가지 않도록 엔진은 동적 import로만 불러온다.
 *   이 파일은 엔진 모듈을 값(value)으로 정적 import하지 않는다(타입만 import).
 */
import type { InputSessionLogDto } from '../../shared/types/backend';
import type { InputMethodId } from '../analysis/types/analysis';
import type {
  MethodRecommendation,
  RecommendationDashboardData,
} from '../analysis/types/recommendation';
import type {
  MeasurementRow,
  Method,
  RecommendationResult,
} from './engine/types';

/** GET /api/input-sessions 응답 행. 프론트에서는 `InputSessionLogDto`로 정의되어 있다. */
export type InputSessionResponseDto = InputSessionLogDto;

type EngineModule = Pick<typeof import('./engine/recommend'), 'recommend'>;
export type EngineLoader = () => Promise<EngineModule>;

const defaultEngineLoader: EngineLoader = () => import('./engine/recommend');

/** 모델 모듈(엔진 코드 또는 모델 JSON chunk) 자체를 불러오지 못했을 때. */
export class RecommendationModelLoadError extends Error {
  constructor(cause: unknown) {
    super('LightGBM 추천 모델을 불러오지 못했습니다.', { cause });
    this.name = 'RecommendationModelLoadError';
  }
}

/** 엔진의 클래스 순서와 동일하다(features.ts METHODS). */
const METHOD_ORDER: readonly Method[] = ['EYE_TRACKING', 'BLINK', 'MOUTH'];

const METHOD_TO_ID: Record<Method, InputMethodId> = {
  EYE_TRACKING: 'gaze',
  BLINK: 'blink',
  MOUTH: 'mouth',
};

// 화면 라벨은 캘리브레이션 추천(A)과 같은 문구를 쓰되, 두 기능을 독립적으로 유지하기 위해
// A 모듈을 import하지 않고 여기서 따로 정의한다.
const METHOD_INFO: Record<InputMethodId, { label: string; description: string }> = {
  gaze: { label: '시선', description: '화면을 응시하여 입력' },
  blink: { label: '눈 깜빡임', description: '눈을 깜빡여 입력' },
  mouth: { label: '입 움직임', description: '입 움직임으로 입력' },
};

function isMethod(value: unknown): value is Method {
  return typeof value === 'string' && (METHOD_ORDER as readonly string[]).includes(value);
}

/**
 * API 응답 → 모델 입력 행.
 * 모델(`buildFeatures`)은 범위를 벗어난 값이 하나라도 있으면 해당 측정 전체를 예외로 처리해
 * 규칙 폴백으로 넘어가므로, 유효하지 않은 행은 여기서 미리 제외한다.
 * - inputSpeed: 분당 음절 수(60000 / durationMs). 0보다 큰 유한수만 허용(초 단위 값 아님).
 * - typoRate: 0~1 비율. 백분율(예: 12)로 저장된 값은 제외한다.
 * - sessionAt: 파싱 가능한 시각만 허용(그룹 정렬 기준).
 * - calibrationId: 측정 그룹 키. 없으면 제외.
 */
export function toMeasurementRows(rows: readonly InputSessionResponseDto[]): MeasurementRow[] {
  return rows.flatMap((row): MeasurementRow[] => {
    if (row.sessionType !== undefined && row.sessionType !== 'CALIBRATION_TEST') return [];
    if (typeof row.calibrationId !== 'string' || row.calibrationId.trim() === '') return [];
    if (!isMethod(row.inputMethod)) return [];
    if (typeof row.sessionAt !== 'string' || !Number.isFinite(Date.parse(row.sessionAt))) return [];

    const { inputSpeed, typoRate } = row;
    if (typeof inputSpeed !== 'number' || !Number.isFinite(inputSpeed) || inputSpeed <= 0) return [];
    if (typeof typoRate !== 'number' || !Number.isFinite(typoRate) || typoRate < 0 || typoRate > 1) {
      return [];
    }

    return [
      {
        calibrationId: row.calibrationId,
        inputMethod: row.inputMethod,
        inputSpeed,
        typoRate,
        sessionAt: row.sessionAt,
      },
    ];
  });
}

/**
 * 엔진 `recommend()`가 "최신 측정"으로 고르는 그룹과 같은 규칙으로 최신 calibration의 방식별 행을 찾는다.
 * (calibrationId별로 묶고 방식마다 가장 늦은 행을 남긴 뒤, 그룹 내 최대 sessionAt이 가장 늦은 그룹.
 * 동률이면 먼저 등장한 그룹 — 엔진의 안정 정렬과 동일.)
 * 엔진 결과에는 원시 inputSpeed가 없으므로 화면 표시용 값을 이 행들에서 가져온다.
 */
export function getLatestMeasurementRows(rows: readonly MeasurementRow[]): MeasurementRow[] {
  const groups = new Map<string, Map<Method, MeasurementRow>>();

  for (const row of rows) {
    const methods = groups.get(row.calibrationId) ?? new Map<Method, MeasurementRow>();
    groups.set(row.calibrationId, methods);
    const previous = methods.get(row.inputMethod);
    if (!previous || Date.parse(row.sessionAt) >= Date.parse(previous.sessionAt)) {
      methods.set(row.inputMethod, row);
    }
  }

  let latest: MeasurementRow[] = [];
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const methods of groups.values()) {
    const groupRows = [...methods.values()];
    const time = Math.max(...groupRows.map((row) => Date.parse(row.sessionAt)));
    if (time > latestTime) {
      latest = groupRows;
      latestTime = time;
    }
  }

  return latest;
}

/** 엔진 결과 → 기존 화면 타입. `RecommendationDashboardData`는 변경하지 않는다. */
export function toDashboardData(
  result: RecommendationResult,
  latestRows: readonly MeasurementRow[],
): RecommendationDashboardData {
  const latestByMethod = new Map(latestRows.map((row) => [row.inputMethod, row]));

  const methods: MethodRecommendation[] = METHOD_ORDER.map((method) => {
    const id = METHOD_TO_ID[method];
    const modelMethod = result.methods.find((item) => item.method === method);
    const present = modelMethod?.present ?? false;
    const row = present ? latestByMethod.get(method) : undefined;

    return {
      id,
      label: METHOD_INFO[id].label,
      description: METHOD_INFO[id].description,
      // 세 방식 합 100인 이력 가중 클래스 확률(정수). 측정하지 않은 방식은 화면에서 숨겨진다.
      score: present && modelMethod ? modelMethod.score : null,
      present,
      typoRatePercent: present ? (modelMethod?.typoRatePercent ?? null) : null,
      // 원시 분당 음절 수. 막대 비율은 RecommendationResults가 최대값 대비로 계산한다
      // (엔진의 speedPercent와 같은 식).
      inputSpeed: row ? row.inputSpeed : null,
    };
  });

  return {
    measuredAt: result.measuredAt,
    engine: result.engine,
    recommendedMethod: result.recommendedMethod ? METHOD_TO_ID[result.recommendedMethod] : null,
    methods,
  };
}

/** 이력이 없거나 아직 결과가 없을 때 화면에 넘길 빈 데이터(임시 추천값 없음). */
export function createEmptyRecommendationDashboard(): RecommendationDashboardData {
  return {
    measuredAt: null,
    engine: 'model',
    recommendedMethod: null,
    methods: METHOD_ORDER.map((method) => {
      const id = METHOD_TO_ID[method];
      return {
        id,
        label: METHOD_INFO[id].label,
        description: METHOD_INFO[id].description,
        score: null,
        present: false,
        typoRatePercent: null,
        inputSpeed: null,
      };
    }),
  };
}

export interface RecommendFromHistoryOptions {
  /** 테스트용 주입 지점. 기본값은 엔진 동적 import. */
  loadEngine?: EngineLoader;
}

/**
 * 누적 CALIBRATION_TEST 이력(최근 최대 10회 측정, HISTORY_DECAY 0.5)으로 LightGBM 추천을 계산한다.
 * - 유효한 이력이 없으면 모델을 불러오지 않고 빈 결과를 반환한다.
 * - 추론 중 오류는 엔진 내부 규칙 폴백(engine: 'rule-fallback')이 처리한다.
 * - 엔진 모듈 자체를 불러오지 못하면 `RecommendationModelLoadError`를 던진다(A 추천으로 대체하지 않음).
 */
export async function recommendFromHistory(
  rows: readonly InputSessionResponseDto[],
  options: RecommendFromHistoryOptions = {},
): Promise<RecommendationDashboardData> {
  const history = toMeasurementRows(rows);

  if (history.length === 0) {
    return createEmptyRecommendationDashboard();
  }

  let engine: EngineModule;
  try {
    engine = await (options.loadEngine ?? defaultEngineLoader)();
  } catch (error) {
    throw new RecommendationModelLoadError(error);
  }

  const result = engine.recommend(history);
  return toDashboardData(result, getLatestMeasurementRows(history));
}

/**
 * 개발 서버(vite dev)에서만 출력하는 진단 로그. 실제 모델 추론 여부를 브라우저 콘솔에서 확인하기 위함.
 * 개수·엔진·추천 방식·점수만 출력하며 응답 본문, 식별자, 토큰은 출력하지 않는다.
 */
function logRecommendationDiagnostics(
  rows: readonly InputSessionResponseDto[],
  data: RecommendationDashboardData,
): void {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return;

  const validRows = toMeasurementRows(rows);
  console.info('[LookTalk:LightGBM]', {
    fetchedRows: rows.length,
    validGroups: new Set(validRows.map((row) => row.calibrationId)).size,
    engine: data.engine,
    recommendedMethod: data.recommendedMethod,
    scores: Object.fromEntries(data.methods.map((method) => [method.id, method.score])),
  });
}

export type AnalysisRecommendationState =
  | { status: 'loading' }
  | { status: 'ready'; data: RecommendationDashboardData }
  | { status: 'empty' }
  | { status: 'api-error' }
  | { status: 'model-error' };

export interface LoadAnalysisRecommendationOptions extends RecommendFromHistoryOptions {
  fetchRows: () => Promise<readonly InputSessionResponseDto[]>;
}

/** `/analysis` 화면 상태 결정: 조회 실패, 데이터 없음, 모델 로딩 실패를 구분한다. */
export async function loadAnalysisRecommendation({
  fetchRows,
  loadEngine,
}: LoadAnalysisRecommendationOptions): Promise<Exclude<AnalysisRecommendationState, { status: 'loading' }>> {
  let rows: readonly InputSessionResponseDto[];
  try {
    rows = await fetchRows();
  } catch {
    return { status: 'api-error' };
  }

  try {
    const data = await recommendFromHistory(rows, { loadEngine });
    logRecommendationDiagnostics(rows, data);
    return data.recommendedMethod === null && data.methods.every((method) => !method.present)
      ? { status: 'empty' }
      : { status: 'ready', data };
  } catch (error) {
    // 모델 모듈 로딩 실패(RecommendationModelLoadError)와 예기치 못한 엔진 오류 모두
    // 추천 결과를 만들 수 없는 상태이므로 명시적인 모델 오류로 표시한다.
    console.error('LightGBM 추천 계산 실패:', error);
    return { status: 'model-error' };
  }
}
