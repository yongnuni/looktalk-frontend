import type { AnalysisItem } from '../types/analysis';

export const analysisItems: AnalysisItem[] = [
  {
    id: 'blink',
    inputMethod: '눈 깜빡 키보드',
    recommendedMethod: '입 뻥긋 키보드',
    metrics: [
      { id: 'typo-rate', label: '오타율', value: 25 },
      { id: 'input-speed', label: '입력 속도', value: 62 },
      { id: 'recognition-accuracy', label: '인식 정확도', value: 55 },
      { id: 'input-stability', label: '입력 안정성', value: 43 },
    ],
  },
  {
    id: 'mouth',
    inputMethod: '입 뻥긋 키보드',
    recommendedMethod: '입 뻥긋 키보드',
    metrics: [
      { id: 'typo-rate', label: '오타율', value: 18 },
      { id: 'input-speed', label: '입력 속도', value: 71 },
      { id: 'recognition-accuracy', label: '인식 정확도', value: 68 },
      { id: 'input-stability', label: '입력 안정성', value: 64 },
    ],
  },
  {
    id: 'gaze',
    inputMethod: '시선 키보드',
    recommendedMethod: '입 뻥긋 키보드',
    metrics: [
      { id: 'typo-rate', label: '오타율', value: 32 },
      { id: 'input-speed', label: '입력 속도', value: 49 },
      { id: 'recognition-accuracy', label: '인식 정확도', value: 59 },
      { id: 'input-stability', label: '입력 안정성', value: 38 },
    ],
  },
];

export const initialAnalysis = analysisItems[0];
