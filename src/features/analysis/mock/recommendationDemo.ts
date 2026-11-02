import type { RecommendationDashboardData, RecommendationMetric } from '../types/recommendation';

const metrics = (speed: number, stability: number): RecommendationMetric[] => [
  { id: 'typo-rate', label: '오타율', percent: 0 },
  { id: 'input-speed', label: '입력 속도', percent: speed },
  { id: 'recognition-accuracy', label: '인식 정확도', percent: 100 },
  { id: 'input-stability', label: '입력 안정성', percent: stability },
];

/** Exhibition fixtures only. Never persist these as calibration or model results. */
export const recommendationDemo: RecommendationDashboardData = {
  source: 'demo',
  measuredAt: null,
  recommendedMethod: 'gaze',
  methods: [
    { id: 'gaze', label: '시선', description: '화면을 응시하여 입력', score: 98, metrics: metrics(100, 92) },
    { id: 'blink', label: '눈 깜빡임', description: '눈을 깜빡여 입력', score: 82, metrics: metrics(60, 80) },
    { id: 'mouth', label: '입 움직임', description: '입 움직임으로 입력', score: 91, metrics: metrics(77, 87) },
  ],
};
