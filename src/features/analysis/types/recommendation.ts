import type { InputMethodId } from './analysis';

export interface MethodRecommendation {
  id: InputMethodId;
  label: string;
  description: string;
  score: number | null;
  present: boolean;
  typoRatePercent: number | null;
  inputSpeed: number | null;
}

export interface RecommendationDashboardData {
  measuredAt: string | null;
  engine: 'model' | 'rule-fallback';
  recommendedMethod: InputMethodId | null;
  methods: MethodRecommendation[];
}
