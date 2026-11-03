import type { InputSessionLogDto } from '../../../shared/types/backend';

import { mapInputSessionLogToAnalysisItem } from '../utils/analysisMappers';

import type { AnalysisItem, InputMethodId } from '../types/analysis';

interface AnalysisMockSeed {
  inputMethodId: InputMethodId;
  inputMethod: string;
  recommendedMethod: string;
  log: InputSessionLogDto;
}

const analysisMockSeeds: AnalysisMockSeed[] = [
  {
    inputMethodId: 'blink',
    inputMethod: '눈 깜빡 키보드',
    recommendedMethod: '입 뻥긋 키보드',
    log: {
      logId: 'session-blink-001',
      calibrationId: null,
      inputMethod: 'BLINK',
      sessionType: 'CALIBRATION_TEST',
      keyboardLayout: 'QWERTY',

      typoRate: 9,
      inputSpeed: 82,
      recognitionAccuracy: 89,
      inputStability: 86,

      sessionAt: null,
    },
  },

  {
    inputMethodId: 'mouth',
    inputMethod: '입 뻥긋 키보드',
    recommendedMethod: '입 뻥긋 키보드',
    log: {
      logId: 'session-mouth-001',
      calibrationId: null,
      inputMethod: 'MOUTH',
      sessionType: 'CALIBRATION_TEST',
      keyboardLayout: 'QWERTY',

      typoRate: 6,
      inputSpeed: 88,
      recognitionAccuracy: 93,
      inputStability: 91,

      sessionAt: null,
    },
  },

  {
    inputMethodId: 'gaze',
    inputMethod: '시선 키보드',
    recommendedMethod: '입 뻥긋 키보드',
    log: {
      logId: 'session-gaze-001',
      calibrationId: null,
      inputMethod: 'EYE_TRACKING',
      sessionType: 'CALIBRATION_TEST',
      keyboardLayout: 'QWERTY',

      typoRate: 4,
      inputSpeed: 92,
      recognitionAccuracy: 96,
      inputStability: 94,

      sessionAt: null,
    },
  },
];

export const analysisItems: AnalysisItem[] = analysisMockSeeds.map((seed) =>
  mapInputSessionLogToAnalysisItem(
    seed.log,
    seed.inputMethodId,
    seed.inputMethod,
    seed.recommendedMethod,
  ),
);

export const initialAnalysis = analysisItems[0];
