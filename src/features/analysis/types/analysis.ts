export type InputMethodId = 'gaze' | 'blink' | 'mouth';

export interface AnalysisMetric {
  id: string;
  label: string;
  value: number;
}

export interface AnalysisItem {
  id: InputMethodId;
  inputMethod: string;
  recommendedMethod: string;
  metrics: AnalysisMetric[];
}
