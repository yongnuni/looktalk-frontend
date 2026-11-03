import type { RecommendationDashboardData } from '../types/recommendation';

/** Exhibition fixtures only. Never persist these as calibration or model results. */
export const recommendationDemo: RecommendationDashboardData = {
  measuredAt: null,
  engine: 'rule-fallback',
  recommendedMethod: 'gaze',
  methods: [
    {
      id: 'gaze',
      label: '시선',
      description: '화면을 응시하여 입력',
      score: null,
      present: true,
      typoRatePercent: 0,
      inputSpeed: 15.8,
    },
    {
      id: 'blink',
      label: '눈 깜빡임',
      description: '눈을 깜빡여 입력',
      score: null,
      present: true,
      typoRatePercent: 0,
      inputSpeed: 9.5,
    },
    {
      id: 'mouth',
      label: '입 움직임',
      description: '입 움직임으로 입력',
      score: null,
      present: true,
      typoRatePercent: 0,
      inputSpeed: 12.2,
    },
  ],
};
