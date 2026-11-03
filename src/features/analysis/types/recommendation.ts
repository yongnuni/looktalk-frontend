import type { InputMethodId } from './analysis';

export interface RecommendationMetric {
  id: string;
  label: string;
  /** Display percentage, not a raw measurement or model input. */
  percent: number;
}

export interface MethodRecommendation {
  id: InputMethodId;
  label: string;
  description: string;
  score: number;
  metrics: RecommendationMetric[];
}

export interface RecommendationDashboardData {
  source: 'demo' | 'api';
  measuredAt: string | null;
  recommendedMethod: InputMethodId;
  methods: MethodRecommendation[];
}
