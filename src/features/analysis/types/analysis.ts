export type InputMethodId = 'gaze' | 'blink' | 'mouth';

export interface AnalysisMetric {
  id: string;
  label: string;
  value: number;
}

export interface AnalysisItem {
  id: InputMethodId;
  sessionLogId: string;
  inputMethod: string;
  recommendedMethod: string;
  keyboardLayout: string;
  typoRate: number;
  inputSpeed: number;
  recognitionAccuracy: number;
  inputStability: number;
  sessionAt: string | null;
  metrics: AnalysisMetric[];
}
