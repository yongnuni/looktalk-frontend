import type {
  BlinkCalibrationSnapshot,
  MouthCalibrationSnapshot,
} from '../inputCalibration';

interface InputCalibrationPanelProps {
  kind: 'blink' | 'mouth';
  snapshot: BlinkCalibrationSnapshot | MouthCalibrationSnapshot;
  onRestart: () => void;
  onContinueWithDefaults: () => void;
}

export default function InputCalibrationPanel({
  kind,
  snapshot,
  onRestart,
  onContinueWithDefaults,
}: InputCalibrationPanelProps) {
  const isBlink = kind === 'blink';
  const title = isBlink ? '눈 깜빡임 측정' : '입 움직임 측정';
  const signalLabel = isBlink ? 'EAR' : 'MAR';
  const signalValue = isBlink
    ? (snapshot as BlinkCalibrationSnapshot).currentEar
    : (snapshot as MouthCalibrationSnapshot).currentMar;

  return (
    <section className="input-calibration-panel" aria-live="polite">
      <p className="input-calibration-panel__kicker">{title}</p>
      <h2>{snapshot.instruction}</h2>

      <p
        className={`input-calibration-panel__face input-calibration-panel__face--${
          snapshot.faceDetected ? 'detected' : 'missing'
        }`}
      >
        <span aria-hidden="true" />
        {snapshot.faceDetected ? '얼굴 인식 중' : '얼굴을 찾는 중 — 측정 일시 정지'}
      </p>

      <div className="input-calibration-panel__count">
        <strong>
          {snapshot.trialNumber} / {snapshot.totalTrials}
        </strong>
        <span>{title}</span>
      </div>

      <div className="input-calibration-panel__steps" aria-label="측정 진행 단계">
        {Array.from({ length: snapshot.totalTrials }, (_, index) => (
          <span
            key={index}
            className={
              index < snapshot.completedTrials
                ? 'is-complete'
                : index === snapshot.completedTrials
                  ? 'is-current'
                  : ''
            }
          >
            {index + 1}
          </span>
        ))}
      </div>

      <div className="input-calibration-panel__progress" aria-hidden="true">
        <span style={{ width: `${Math.round(snapshot.phaseProgress * 100)}%` }} />
      </div>

      {snapshot.attemptNumber > 1 && !snapshot.done && (
        <p className="input-calibration-panel__attempt">
          현재 단계 재시도 {snapshot.attemptNumber} / 3
        </p>
      )}

      <p className="input-calibration-panel__signal">
        {signalLabel} {signalValue === null ? '-' : signalValue.toFixed(3)}
      </p>

      <div className="input-calibration-panel__actions">
        <button type="button" onClick={onRestart}>
          {title} 다시 측정
        </button>
        {snapshot.failed && (
          <button
            type="button"
            className="input-calibration-panel__fallback"
            onClick={onContinueWithDefaults}
          >
            기본값으로 계속
          </button>
        )}
      </div>
    </section>
  );
}
