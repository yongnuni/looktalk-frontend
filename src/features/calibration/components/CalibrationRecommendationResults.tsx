import { useCallback, useRef } from 'react';
import RecommendationResults from '../../analysis/components/RecommendationResults';
import type { RecommendationDashboardData } from '../../analysis/types/recommendation';
import type { SubscribeCalibrationCompletionGaze } from '../completionGaze/types';
import { useCalibrationCompletionGaze } from '../completionGaze/useCalibrationCompletionGaze';
import '../../analysis/components/AnalysisDashboard.css';
import './CalibrationRecommendationResults.css';

interface Props {
  data: RecommendationDashboardData;
  subscribeCompletionGaze: SubscribeCalibrationCompletionGaze;
  onRetest: () => void;
  onChangeInput: () => void;
}

/** Adapter for the calibration-owned camera/selection runtime; dashboard UI stays shared. */
export default function CalibrationRecommendationResults({
  data,
  subscribeCompletionGaze,
  onRetest,
  onChangeInput,
}: Props) {
  const retestRef = useRef<HTMLButtonElement | null>(null);
  const changeInputRef = useRef<HTMLButtonElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);

  const getTargets = useCallback(
    () => [
      {
        id: 'calibration-dashboard-retest',
        element: retestRef.current,
        enabled: true,
        onSelect: onRetest,
      },
      {
        id: 'calibration-dashboard-back',
        element: backRef.current,
        enabled: true,
        onSelect: onChangeInput,
      },
      {
        id: 'calibration-dashboard-change-input',
        element: changeInputRef.current,
        enabled: true,
        onSelect: onChangeInput,
      },
    ],
    [onRetest, onChangeInput],
  );

  useCalibrationCompletionGaze({
    active: true,
    subscribe: subscribeCompletionGaze,
    getTargets,
  });

  return (
    <div className="analysis-page calibration-recommendation-results">
      <div className="analysis-shell">
        <RecommendationResults
          data={data}
          onRetest={onRetest}
          retestRef={retestRef}
          onChangeInput={onChangeInput}
          changeInputRef={changeInputRef}
        />

        <div className="calibration-recommendation-results__footer">
          <button
            ref={backRef}
            type="button"
            className="calibration-recommendation-results__back"
            onClick={onChangeInput}
          >
            뒤로가기
          </button>
        </div>
      </div>
    </div>
  );
}
