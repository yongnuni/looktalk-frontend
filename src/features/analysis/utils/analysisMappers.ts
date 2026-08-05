import type { InputSessionLogDto } from '../../../shared/types/backend';
import type { AnalysisItem, InputMethodId } from '../types/analysis';

export const inputMethodIdToBackendValue: Record<InputMethodId, string> = {
  gaze: 'GAZE',
  blink: 'BLINK',
  mouth: 'MOUTH',
};

export function inputMethodBackendValueToId(value: string): InputMethodId | null {
  const normalizedValue = value.trim().toUpperCase();
  const match = Object.entries(inputMethodIdToBackendValue).find(
    ([, backendValue]) => backendValue === normalizedValue,
  );

  return (match?.[0] as InputMethodId | undefined) ?? null;
}

export function mapInputSessionLogToAnalysisItem(
  log: InputSessionLogDto,
  inputMethodId: InputMethodId,
  inputMethod: string,
  recommendedMethod: string,
): AnalysisItem {
  const typoRate = log.typo_rate ?? 0;
  const inputSpeed = log.input_speed ?? 0;
  const recognitionAccuracy = log.recognition_accuracy ?? 0;
  const inputStability = log.input_stability ?? 0;

  return {
    id: inputMethodId,
    sessionLogId: log.log_id,
    inputMethod,
    recommendedMethod,
    keyboardLayout: log.keyboard_layout,
    typoRate,
    inputSpeed,
    recognitionAccuracy,
    inputStability,
    sessionAt: log.session_at,
    metrics: [
      { id: 'typo-rate', label: '오타율', value: typoRate },
      { id: 'input-speed', label: '입력 속도', value: inputSpeed },
      { id: 'recognition-accuracy', label: '인식 정확도', value: recognitionAccuracy },
      { id: 'input-stability', label: '입력 안정성', value: inputStability },
    ],
  };
}
