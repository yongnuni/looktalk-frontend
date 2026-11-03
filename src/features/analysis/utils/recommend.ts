import type { InputMethodId } from '../types/analysis';
import type {
  RecommendationDashboardData,
  MethodRecommendation,
} from '../types/recommendation';

export interface MeasurementRow {
  calibrationId: string;
  inputMethod: 'EYE_TRACKING' | 'BLINK' | 'MOUTH';
  inputSpeed: number;
  typoRate: number;
  sessionAt: string | null;
}

const METHOD_ORDER: InputMethodId[] = ['gaze', 'blink', 'mouth'];

const METHOD_INFO: Record<
  InputMethodId,
  {
    label: string;
    description: string;
    backendValue: MeasurementRow['inputMethod'];
  }
> = {
  gaze: {
    label: '시선',
    description: '화면을 응시하여 입력',
    backendValue: 'EYE_TRACKING',
  },
  blink: {
    label: '눈 깜빡임',
    description: '눈을 깜빡여 입력',
    backendValue: 'BLINK',
  },
  mouth: {
    label: '입 움직임',
    description: '입 움직임으로 입력',
    backendValue: 'MOUTH',
  },
};

function toInputMethodId(value: MeasurementRow['inputMethod']): InputMethodId {
  switch (value) {
    case 'EYE_TRACKING':
      return 'gaze';
    case 'BLINK':
      return 'blink';
    case 'MOUTH':
      return 'mouth';
  }
}

function getLatestMeasurement(rows: MeasurementRow[]): MeasurementRow[] {
  if (rows.length === 0) return [];

  const sorted = [...rows].sort((a, b) => {
    const dateA = a.sessionAt ? new Date(a.sessionAt).getTime() : 0;
    const dateB = b.sessionAt ? new Date(b.sessionAt).getTime() : 0;
    return dateB - dateA;
  });

  const latestCalibrationId = sorted[0].calibrationId;

  return sorted.filter((row) => row.calibrationId === latestCalibrationId);
}

function createMethodRecommendations(
  latestRows: MeasurementRow[],
): MethodRecommendation[] {
  return METHOD_ORDER.map((methodId) => {
    const info = METHOD_INFO[methodId];

    const row = latestRows.find(
      (item) => toInputMethodId(item.inputMethod) === methodId,
    );

    if (!row) {
      return {
        id: methodId,
        label: info.label,
        description: info.description,
        score: null,
        present: false,
        typoRatePercent: null,
        inputSpeed: null,
      };
    }

    return {
      id: methodId,
      label: info.label,
      description: info.description,

      // LightGBM 모델 연결 전이므로 실제 추천 확률은 표시하지 않는다.
      score: null,

      present: true,
      typoRatePercent: row.typoRate * 100,
      inputSpeed: row.inputSpeed,
    };
  });
}

export function recommend(
  history: MeasurementRow[],
  current: MeasurementRow[] = [],
): RecommendationDashboardData {
  // 같은 측정의 데이터가 history와 current에 중복되면 current를 우선한다.
  const combined = new Map<string, MeasurementRow>();

  [...history, ...current].forEach((row) => {
    const key = `${row.calibrationId}_${row.inputMethod}`;
    combined.set(key, row);
  });

  const latestRows = getLatestMeasurement(Array.from(combined.values()));

  if (latestRows.length === 0) {
    return {
      measuredAt: null,
      engine: 'rule-fallback',
      recommendedMethod: null,
      methods: createMethodRecommendations([]),
    };
  }

  // 유효한 측정값만 추천 후보로 사용한다.
  const validRows = latestRows.filter(
    (row) =>
      Number.isFinite(row.typoRate) &&
      row.typoRate >= 0 &&
      row.typoRate <= 1 &&
      Number.isFinite(row.inputSpeed) &&
      row.inputSpeed >= 0,
  );

  // 오타율 오름차순 → 입력 속도 내림차순 → METHOD_ORDER 순서
  validRows.sort((a, b) => {
    if (a.typoRate !== b.typoRate) {
      return a.typoRate - b.typoRate;
    }

    if (a.inputSpeed !== b.inputSpeed) {
      return b.inputSpeed - a.inputSpeed;
    }

    return (
      METHOD_ORDER.indexOf(toInputMethodId(a.inputMethod)) -
      METHOD_ORDER.indexOf(toInputMethodId(b.inputMethod))
    );
  });

  const recommendedMethod =
    validRows.length > 0 ? toInputMethodId(validRows[0].inputMethod) : null;

  const latestSessionAt =
    latestRows
      .map((row) => row.sessionAt)
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ?? null;

  return {
    measuredAt: latestSessionAt,
    engine: 'rule-fallback',
    recommendedMethod,
    methods: createMethodRecommendations(latestRows),
  };
}
