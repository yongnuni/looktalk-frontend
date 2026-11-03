import { useCallback, useMemo, useRef, useState } from 'react';
import type { InputMethod } from '../../../shared/types/backend';
import type {
  CalibrationCompletionGazeTarget,
  SubscribeCalibrationCompletionGaze,
} from '../completionGaze/types';
import { useCalibrationCompletionGaze } from '../completionGaze/useCalibrationCompletionGaze';
import { useUserSettings } from '../../userSetting/hooks/useUserSettings';
import { createCalibration } from '../api/calibrationApi';
import { createInputSession } from '../api/inputSessionApi';
import { CALIBRATION_RMSE_WARNING_THRESHOLD_NORMALIZED } from '../constants';
import { useCalibrationStore } from '../store/calibrationStore';
import { useUserSettingStore } from '../../userSetting/store/userSettingStore';
import type { InputCalibrationResult } from '../inputCalibration';
import type { GazeCalibrationResult } from '../types';
import type { HomographyPointDiagnostic } from '../homography';
import type { PatientInputTestResults } from '../PatientCalibrationFlow';
import {
  completeMeasurementResultAction,
  type MeasurementResultAction,
} from '../measurementResultAction';

import { recommend, type MeasurementRow } from '../../analysis/utils/recommend';

import type { RecommendationDashboardData } from '../../analysis/types/recommendation';

import CalibrationRecommendationResults from './CalibrationRecommendationResults';
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
  const [showDashboard, setShowDashboard] = useState(false);
  const [modalState, setModalState] = useState<ModalState>('SELECTING');
  const [pendingAction, setPendingAction] =
    useState<MeasurementResultAction | null>(null);

  const [savedCalibrationId, setSavedCalibrationId] = useState<string | null>(
    null,
  );

  // 이번 측정의 기준 시각
  const [measuredAt] = useState(() => new Date().toISOString());

  const methodButtonRefs = useRef(new Map<InputMethod, HTMLButtonElement>());
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);
  const retestButtonRef = useRef<HTMLButtonElement | null>(null);
  const analysisButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectionInFlightRef = useRef(false);

  const setActiveCalibration = useCalibrationStore((state) => state.setActive);
  const { updateSettings } = useUserSettings();

  /**
   * 실제 입력 테스트 결과를 추천 분석용 데이터로 변환한다.
   *
   * inputSpeed: 분당 입력 속도
   * typoRate: 오타율 (0~1 비율)
   */
  const recommendationData: RecommendationDashboardData = useMemo(() => {
    const calibrationId = savedCalibrationId ?? 'current-calibration';

    const results = [
      {
        result: inputTestResults.gaze,
        inputMethod: 'EYE_TRACKING' as const,
      },
      {
        result: inputTestResults.blink,
        inputMethod: 'BLINK' as const,
      },
      {
        result: inputTestResults.mouth,
        inputMethod: 'MOUTH' as const,
      },
    ];

    const measurementRows: MeasurementRow[] = results.flatMap(
      ({ result, inputMethod }) => {
        if (
          !result ||
          result.durationMs <= 0 ||
          result.confirmationAttempts <= 0
        ) {
          return [];
        }

        const inputSpeed = 60000 / result.durationMs;
        const typoRate = result.incorrectAttempts / result.confirmationAttempts;

        if (
          !Number.isFinite(inputSpeed) ||
          !Number.isFinite(typoRate) ||
          inputSpeed <= 0 ||
          typoRate < 0
        ) {
          return [];
        }

        return [
          {
            calibrationId,
            inputMethod,
            inputSpeed,
            typoRate,
            sessionAt: measuredAt,
          },
        ];
      },
    );

    // 현재 측정 결과만으로 규칙 기반 추천을 생성한다.
    // 실제 모델 결과가 없으므로 추천 확률은 생성하지 않는다.
    return recommend([], measurementRows);
  }, [inputTestResults, measuredAt, savedCalibrationId]);

  const handleAction = useCallback(
    async (action: MeasurementResultAction) => {
      if (modalState === 'SAVING' || selectionInFlightRef.current) {
        return;
      }

      selectionInFlightRef.current = true;

      if (action.type === 'apply-method') {
        onSaving();
      }

      setPendingAction(action);
      setModalState('SAVING');

      try {
        await completeMeasurementResultAction(action, {
          saveCalibration: async () => {
            // 이미 성공적으로 저장했다면 중복 저장하지 않는다.
            if (savedCalibrationId) return;

            const persisted = await createCalibration(candidate);

            setSavedCalibrationId(persisted.calibrationId);
            setActiveCalibration(persisted.calibrationId, persisted.result);

            // 현재 사용자 설정에서 키보드 레이아웃을 가져온다.
            const keyboardLayout =
              useUserSettingStore.getState().settings?.keyboardLayout;

            // 실제 측정 결과가 존재하는 입력 방식만 저장한다.
            const results = [
              {
                result: inputTestResults.gaze,
                inputMethod: 'EYE_TRACKING' as const,
              },
              {
                result: inputTestResults.blink,
                inputMethod: 'BLINK' as const,
              },
              {
                result: inputTestResults.mouth,
                inputMethod: 'MOUTH' as const,
              },
            ];

            // 한 방식의 저장 실패가 다른 방식의 저장을 막지 않는다.
            await Promise.allSettled(
              results.map(async ({ result, inputMethod }) => {
                if (
                  !result ||
                  result.durationMs <= 0 ||
                  result.confirmationAttempts <= 0
                ) {
                  return;
                }

                const typoRate =
                  result.incorrectAttempts / result.confirmationAttempts;

                await createInputSession({
                  sessionType: 'CALIBRATION_TEST',
                  inputMethod,
                  calibrationId: persisted.calibrationId,
                  ...(keyboardLayout ? { keyboardLayout } : {}),
                  typoRate,
                  inputSpeed: 60000 / result.durationMs,
                  recognitionAccuracy: null,
                  inputStability: null,
                });
              }),
            );
          },

          applyInputMethod: (method) =>
            updateSettings({ currentInputMethod: method }),

          onApplied,

          onViewAnalysis: () => {
            selectionInFlightRef.current = false;
            setModalState('SELECTING');
            setShowDashboard(true);
          },
        });
      } catch {
        selectionInFlightRef.current = false;

        if (action.type === 'apply-method') {
          onSaveFailed();
        }

        setModalState('ERROR');
      }
    },
    [
      candidate,
      modalState,
      onApplied,
      onSaveFailed,
      onSaving,
      savedCalibrationId,
      setActiveCalibration,
      updateSettings,
      inputTestResults,
    ],
  );

  const isSaving = modalState === 'SAVING';

  const rmseTooHigh =
    candidate.reprojectionRmseNormalized >
    CALIBRATION_RMSE_WARNING_THRESHOLD_NORMALIZED;

  const getCompletionTargets = useCallback(() => {
    const targets: CalibrationCompletionGazeTarget[] = METHOD_OPTIONS.map(
      (option) => ({
        id: `calibration-method-${option.method}`,
        element: methodButtonRefs.current.get(option.method) ?? null,
        enabled: !isSaving,
        onSelect: () => {
          void handleAction({
            type: 'apply-method',
            method: option.method,
          });
        },
      }),
    );

    if (modalState === 'ERROR' && pendingAction) {
      targets.push({
        id: 'calibration-method-retry',
        element: retryButtonRef.current,
        enabled: !isSaving,
        onSelect: () => {
          void handleAction(pendingAction);
        },
      });
    }

    targets.push({
      id: 'calibration-analysis',
      element: analysisButtonRef.current,
      enabled: !isSaving,
      onSelect: () => {
        void handleAction({ type: 'view-analysis' });
      },
    });

    targets.push({
      id: 'calibration-retest',
      element: retestButtonRef.current,
      enabled: !isSaving,
      onSelect: onRetest,
    });

    return targets;
  }, [handleAction, isSaving, modalState, onRetest, pendingAction]);

  useCalibrationCompletionGaze({
    active: !showDashboard,
    subscribe: subscribeCompletionGaze,
    getTargets: getCompletionTargets,
  });

  // 실제 측정값으로 생성한 추천 데이터를 전달한다.
  if (showDashboard) {
    return (
      <CalibrationRecommendationResults
        data={recommendationData}
        subscribeCompletionGaze={subscribeCompletionGaze}
        onRetest={onRetest}
        onChangeInput={() => setShowDashboard(false)}
      />
    );
  }

  return (
    <div className="measurement-result-modal" role="dialog" aria-modal="true">
      <p className="measurement-result-modal__title">&lt;측정 결과&gt;</p>

      <p className="measurement-result-modal__instruction">
        사용하고 싶은 입력 방식을 선택해주세요.
      </p>

      {rmseTooHigh && (
        <p className="measurement-result-modal__rmse-warning">
          이번 측정의 오차가 평소보다 큽니다. 재측정을 권장하지만, 그래도
          아래에서 입력 방식을 선택해 적용할 수 있습니다.
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

      <div
        className="measurement-result-modal__input-tests"
        aria-label="입력 테스트 결과"
      >
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
                  목표 {result.targetWord} ·{' '}
                  {(result.durationMs / 1_000).toFixed(1)}초 · 오답{' '}
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
            onClick={() =>
              void handleAction({
                type: 'apply-method',
                method: option.method,
              })
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {modalState === 'ERROR' && (
        <div className="measurement-result-modal__error" aria-live="assertive">
          <p>저장에 실패했습니다. 다시 시도해주세요.</p>

          {pendingAction && (
            <button
              ref={retryButtonRef}
              type="button"
              onClick={() => void handleAction(pendingAction)}
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

      <button
        ref={analysisButtonRef}
        type="button"
        className="measurement-result-modal__retest-button"
        disabled={isSaving}
        onClick={() => void handleAction({ type: 'view-analysis' })}
      >
        상세 분석 결과 보기
      </button>

      {isSaving && <p role="status">측정 결과를 저장하고 있습니다…</p>}

      <p className="calibration-rmse">
        재투영 오차(RMSE, normalized):{' '}
        {candidate.reprojectionRmseNormalized.toFixed(4)}
      </p>

      <p className="calibration-rmse">
        viewport: {candidate.calibratedViewport.widthPx}×
        {candidate.calibratedViewport.heightPx}px / mirror:{' '}
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
