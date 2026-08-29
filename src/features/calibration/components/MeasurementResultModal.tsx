import { useCallback, useRef, useState } from 'react';
import type { InputMethod } from '../../../shared/types/backend';
import type {
  CalibrationCompletionGazeTarget,
  SubscribeCalibrationCompletionGaze,
} from '../completionGaze/types';
import { useCalibrationCompletionGaze } from '../completionGaze/useCalibrationCompletionGaze';
import { useUserSettings } from '../../userSetting/hooks/useUserSettings';
import { createCalibration } from '../api/calibrationApi';
import { CALIBRATION_RMSE_WARNING_THRESHOLD_NORMALIZED } from '../constants';
import { useCalibrationStore } from '../store/calibrationStore';
import type { InputCalibrationResult } from '../inputCalibration';
import type { GazeCalibrationResult } from '../types';
import type { HomographyPointDiagnostic } from '../homography';
import type { PatientInputTestResults } from '../PatientCalibrationFlow';
import './MeasurementResultModal.css';

type ModalState = 'SELECTING' | 'SAVING' | 'ERROR';

interface MethodOption {
  method: InputMethod;
  label: string;
}

const METHOD_OPTIONS: MethodOption[] = [
  { method: 'EYE_TRACKING', label: '시선(gaze)' },
  { method: 'BLINK', label: '눈 깜빡임(blink)' },
  { method: 'MOUTH', label: '입 움직임(mouth)' },
];

interface MeasurementResultModalProps {
  candidate: GazeCalibrationResult;
  pointDiagnostics: HomographyPointDiagnostic[] | null;
  subscribeCompletionGaze: SubscribeCalibrationCompletionGaze;
  inputCalibration: InputCalibrationResult;
  inputTestResults: PatientInputTestResults;
  onRetest: () => void;
  onSaving: () => void;
  onSaveFailed: () => void;
  onApplied: (method: InputMethod) => void;
}

// Integration Plan §10 측정 결과 모달. X/닫기 버튼 없음, background click으로 닫히지 않음,
// ESC로 닫히지 않음 — 이 컴포넌트에는 애초에 그런 닫기 트리거 자체가 없다(§10.1).
// 실제 Recommendation API가 없으므로(§10.2) recommendedInputMethod 관련 문구는 렌더링하지 않는다.
export default function MeasurementResultModal({
  candidate,
  pointDiagnostics,
  subscribeCompletionGaze,
  inputCalibration,
  inputTestResults,
  onRetest,
  onSaving,
  onSaveFailed,
  onApplied,
}: MeasurementResultModalProps) {
  const [modalState, setModalState] = useState<ModalState>('SELECTING');
  const [pendingMethod, setPendingMethod] = useState<InputMethod | null>(null);
  const [savedCalibrationId, setSavedCalibrationId] = useState<string | null>(null);
  const methodButtonRefs = useRef(new Map<InputMethod, HTMLButtonElement>());
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);
  const retestButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectionInFlightRef = useRef(false);

  const setActiveCalibration = useCalibrationStore((state) => state.setActive);
  const { updateSettings } = useUserSettings();

  const handleSelect = useCallback(async (method: InputMethod) => {
    if (modalState === 'SAVING' || selectionInFlightRef.current) {
      return;
    }

    selectionInFlightRef.current = true;
    onSaving();
    setPendingMethod(method);
    setModalState('SAVING');

    try {
      // §10.3 권장 순서: Calibration POST 성공 후에만 UserSetting PATCH. 이미 성공한
      // POST는 재시도 시 다시 보내지 않는다(savedCalibrationId가 있으면 건너뜀) — 부분
      // 실패(POST 성공 + PATCH 실패) 복구 시 calibration을 중복 저장하지 않기 위함이다.
      let calibrationId = savedCalibrationId;

      if (!calibrationId) {
        const persisted = await createCalibration(candidate);
        calibrationId = persisted.calibrationId;
        setSavedCalibrationId(calibrationId);
        setActiveCalibration(persisted.calibrationId, persisted.result);
      }

      await updateSettings({ currentInputMethod: method });

      onApplied(method);
    } catch {
      selectionInFlightRef.current = false;
      onSaveFailed();
      setModalState('ERROR');
    }
  }, [
    candidate,
    modalState,
    onApplied,
    onSaveFailed,
    onSaving,
    savedCalibrationId,
    setActiveCalibration,
    updateSettings,
  ]);

  const isSaving = modalState === 'SAVING';
  const rmseTooHigh = candidate.reprojectionRmseNormalized > CALIBRATION_RMSE_WARNING_THRESHOLD_NORMALIZED;

  const getCompletionTargets = useCallback(() => {
    const targets: CalibrationCompletionGazeTarget[] = METHOD_OPTIONS.map((option) => ({
      id: `calibration-method-${option.method}`,
      element: methodButtonRefs.current.get(option.method) ?? null,
      enabled: !isSaving,
      onSelect: () => {
        void handleSelect(option.method);
      },
    }));

    if (modalState === 'ERROR' && pendingMethod) {
      targets.push({
        id: 'calibration-method-retry',
        element: retryButtonRef.current,
        enabled: !isSaving,
        onSelect: () => {
          void handleSelect(pendingMethod);
        },
      });
    }

    targets.push({
      id: 'calibration-retest',
      element: retestButtonRef.current,
      enabled: !isSaving,
      onSelect: onRetest,
    });

    return targets;
  }, [handleSelect, isSaving, modalState, onRetest, pendingMethod]);

  useCalibrationCompletionGaze({
    active: true,
    subscribe: subscribeCompletionGaze,
    getTargets: getCompletionTargets,
  });

  return (
    <div className="measurement-result-modal" role="dialog" aria-modal="true">
      <p className="measurement-result-modal__title">&lt;측정 결과&gt;</p>
      <p className="measurement-result-modal__instruction">
        사용하고 싶은 입력 방식을 선택해주세요.
      </p>

      {/* Final C — Look-Talk 원본(calibration.py 643행)의 RMSE 하드 게이트에 대응하는
          비침습적 경고. Python처럼 말없이 이전 값으로 자동 대체하지 않고 사용자가 직접
          재측정할지 그대로 적용할지 선택하게 한다(§8.5와 동일한 원칙). */}
      {rmseTooHigh && (
        <p className="measurement-result-modal__rmse-warning">
          이번 측정의 오차가 평소보다 큽니다. 재측정을 권장하지만, 그래도 아래에서 입력
          방식을 선택해 적용할 수 있습니다.
        </p>
      )}

      <div className="measurement-result-modal__input-calibration">
        <p>
          눈 깜빡임 측정 완료
          {inputCalibration.blink.fallback && <span>기본값 사용</span>}
        </p>
        <p>
          입 움직임 측정 완료
          {inputCalibration.mouth.fallback && <span>기본값 사용</span>}
        </p>
      </div>

      <div className="measurement-result-modal__input-tests" aria-label="입력 테스트 결과">
        {METHOD_OPTIONS.map((option) => {
          const result =
            option.method === 'EYE_TRACKING'
              ? inputTestResults.gaze
              : option.method === 'BLINK'
                ? inputTestResults.blink
                : inputTestResults.mouth;

          return (
            <section key={option.method}>
              <strong>{option.label}</strong>
              {result ? (
                <p>
                  목표 {result.targetWord} · {(result.durationMs / 1_000).toFixed(1)}초 · 오답{' '}
                  {result.incorrectAttempts}회
                </p>
              ) : (
                <p>결과 없음</p>
              )}
            </section>
          );
        })}
      </div>

      <div className="measurement-result-modal__methods">
        {METHOD_OPTIONS.map((option) => (
          <button
            key={option.method}
            ref={(node) => {
              if (node) {
                methodButtonRefs.current.set(option.method, node);
              } else {
                methodButtonRefs.current.delete(option.method);
              }
            }}
            type="button"
            className="measurement-result-modal__method-button"
            disabled={isSaving}
            onClick={() => void handleSelect(option.method)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {modalState === 'ERROR' && (
        <div className="measurement-result-modal__error" aria-live="assertive">
          <p>저장에 실패했습니다. 다시 시도해주세요.</p>
          {pendingMethod && (
            <button
              ref={retryButtonRef}
              type="button"
              onClick={() => void handleSelect(pendingMethod)}
            >
              다시 시도
            </button>
          )}
        </div>
      )}

      <button
        ref={retestButtonRef}
        type="button"
        className="measurement-result-modal__retest-button"
        disabled={isSaving}
        onClick={onRetest}
      >
        재측정
      </button>

      <p className="calibration-rmse">재투영 오차(RMSE, normalized): {candidate.reprojectionRmseNormalized.toFixed(4)}</p>
      <p className="calibration-rmse">
        viewport: {candidate.calibratedViewport.widthPx}×{candidate.calibratedViewport.heightPx}px / mirror:{' '}
        {candidate.mirrorStrategy}
      </p>

      {pointDiagnostics && (
        <details className="calibration-diagnostics">
          <summary>점별 오차 보기 ({pointDiagnostics.length}점)</summary>
          <table className="calibration-diagnostics-table">
            <thead>
              <tr>
                <th>#</th>
                <th>iris(src)</th>
                <th>target</th>
                <th>predicted</th>
                <th>error</th>
              </tr>
            </thead>
            <tbody>
              {pointDiagnostics.map((d) => (
                <tr key={d.index}>
                  <td>{d.index + 1}</td>
                  <td>
                    {d.source.x.toFixed(4)}, {d.source.y.toFixed(4)}
                  </td>
                  <td>
                    {d.target.x.toFixed(2)}, {d.target.y.toFixed(2)}
                  </td>
                  <td>
                    {d.predicted.x.toFixed(3)}, {d.predicted.y.toFixed(3)}
                  </td>
                  <td>{d.errorNormalized.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
