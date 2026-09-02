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
      log_id: 'session-blink-001',
      user_id: 'patient-test-user',
      calibration_id: null,
      input_method: 'BLINK',
      keyboard_layout: 'QWERTY',

      typo_rate: 9,
      input_speed: 82,
      recognition_accuracy: 89,
      input_stability: 86,

      session_at: null,
    },
  },

  {
    inputMethodId: 'mouth',
    inputMethod: '입 뻥긋 키보드',
    recommendedMethod: '입 뻥긋 키보드',
    log: {
      log_id: 'session-mouth-001',
      user_id: 'patient-test-user',
      calibration_id: null,
      input_method: 'MOUTH',
      keyboard_layout: 'QWERTY',

      typo_rate: 6,
      input_speed: 88,
      recognition_accuracy: 93,
      input_stability: 91,

      session_at: null,
    },
  },

  {
    inputMethodId: 'gaze',
    inputMethod: '시선 키보드',
    recommendedMethod: '입 뻥긋 키보드',
    log: {
      log_id: 'session-gaze-001',
      user_id: 'patient-test-user',
      calibration_id: null,
      input_method: 'GAZE',
      keyboard_layout: 'QWERTY',

      typo_rate: 4,
      input_speed: 92,
      recognition_accuracy: 96,
      input_stability: 94,

      session_at: null,
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
