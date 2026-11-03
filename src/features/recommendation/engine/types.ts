export type Method = 'EYE_TRACKING' | 'BLINK' | 'MOUTH';
export interface MeasurementRow {
  calibrationId: string;
  inputMethod: Method;
  inputSpeed: number; // syllables/minute, NOT seconds
  typoRate: number; // 0..1
  sessionAt: string; // ISO time
}
export interface RecommendationResult {
  recommendedMethod: Method | null;
  measuredAt: string | null;
  engine: 'model' | 'rule-fallback';
  methods: Array<{
    method: Method;
    score: number; // history-weighted class probability * 100 (rounded)
    present: boolean;
    typoRatePercent: number | null;
    speedPercent: number | null;
  }>;
}
