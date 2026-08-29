import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resolveCalibrationCompletionPath } from '../../features/calibration/calibrationGate';
import { resolvePatientCalibrationPopup } from '../../features/calibration/calibrationLandmarkPopup';
import InputCalibrationPanel from '../../features/calibration/components/InputCalibrationPanel';
import InputMethodTestPanel from '../../features/calibration/components/InputMethodTestPanel';
import MeasurementResultModal from '../../features/calibration/components/MeasurementResultModal';
import SettingCompleteModal from '../../features/calibration/components/SettingCompleteModal';
import { useCalibrationRunner } from '../../features/calibration/hooks/useCalibrationRunner';
import { viewportNormalizedToCssPx } from '../../features/calibration/viewportTargets';
import LandmarkPopupAutoOpen from '../../features/landmarkPopup/LandmarkPopupAutoOpen';
import { LandmarkPopupProvider } from '../../features/landmarkPopup/LandmarkPopupProvider';
import './CalibrationPage.css';

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export default function CalibrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRetestFlow =
    searchParams.get('mode') === 'retest' && searchParams.get('source') === 'analysis';

  const [settingApplied, setSettingApplied] = useState(false);

  const {
    permission,
    cameraError,
    videoRef,
    startCalibration,
    faceLoadState,
    faceLoadError,
    progress,
    result,
    pointDiagnostics,
    cursorNormalized,
    subscribeCompletionGaze,
    subscribeInputFrame,
    subscribeTrackingFrame,
    flowStage,
    blinkProgress,
    mouthProgress,
    inputTestTargets,
    inputTestResults,
    completeInputTest,
    restartBlink,
    continueBlinkWithDefaults,
    restartMouth,
    continueMouthWithDefaults,
    markSaving,
    markSaveFailed,
    markComplete,
    restart,
  } = useCalibrationRunner();

  const showStartPrompt = permission !== 'granted';
  const showLoading = permission === 'granted' && faceLoadState !== 'ready';
  const showMeasurementOverlay = permission === 'granted' && faceLoadState === 'ready';
  const showCalibrationStage = showMeasurementOverlay && flowStage === 'GAZE_RUNNING';
  const showBlinkStage = showMeasurementOverlay && flowStage === 'BLINK_RUNNING';
  const showMouthStage = showMeasurementOverlay && flowStage === 'MOUTH_RUNNING';
  const activeInputTest =
    flowStage === 'GAZE_INPUT_TEST' && inputTestTargets.gaze
      ? { method: 'GAZE' as const, targetWord: inputTestTargets.gaze }
      : flowStage === 'BLINK_INPUT_TEST' && inputTestTargets.blink
        ? { method: 'BLINK' as const, targetWord: inputTestTargets.blink }
        : flowStage === 'MOUTH_INPUT_TEST' && inputTestTargets.mouth
          ? { method: 'MOUTH' as const, targetWord: inputTestTargets.mouth }
          : null;
  const showInputTestStage = showMeasurementOverlay && activeInputTest !== null;
  const showReviewStage =
    showMeasurementOverlay && (flowStage === 'REVIEW' || flowStage === 'SAVING');
  const showCompleteStage = showMeasurementOverlay && flowStage === 'COMPLETE';
  const showResultCursor = showInputTestStage || showReviewStage || showCompleteStage;
  const inputCalibration =
    blinkProgress?.result && mouthProgress?.result
      ? { blink: blinkProgress.result, mouth: mouthProgress.result }
      : null;
  const retestActionStartedRef = useRef(false);
  const popupRequest = resolvePatientCalibrationPopup(flowStage, showMeasurementOverlay);

  const handleBackToAnalysis = useCallback(() => {
    navigate('/analysis');
  }, [navigate]);

  // §10.4 재측정 — 현재 candidate만 폐기하고 기존 active calibration은 그대로 둔다.
  // restart()가 sessionRef 리셋 + candidate clear를 모두 수행한다(useCalibrationRunner).
  const handleRetest = useCallback(() => {
    if (retestActionStartedRef.current) {
      return;
    }

    retestActionStartedRef.current = true;
    setSettingApplied(false);
    restart();
  }, [restart]);

  // §10.3 완료 — 두 요청(Calibration POST, UserSetting PATCH) 모두 성공한 뒤에만 호출된다
  // (MeasurementResultModal 내부에서 보장). 측정 결과 모달을 닫고 설정 완료 모달을 띄운다.
  const handleApplied = useCallback(() => {
    markComplete();
    setSettingApplied(true);
  }, [markComplete]);

  // §10/§11 — 최초 Bootstrap Calibration은 실제 PATIENT Main인 ROUTES.MAIN(/main)으로,
  // Analysis 재측정은 기존 계약대로 /analysis로 돌아간다(/patient는 VirtualKeyboard가
  // 연결된 개발용/고아 route일 뿐 실제 서비스 Main이 아니다). isRetestFlow는 기존
  // ?mode=retest&source=analysis 계약을 그대로 재사용한다(새 query parameter 추가 안 함).
  const handleSuccessConfirm = useCallback(() => {
    navigate(resolveCalibrationCompletionPath(isRetestFlow));
  }, [isRetestFlow, navigate]);

  useEffect(() => {
    if (!showReviewStage) {
      retestActionStartedRef.current = false;
    }
  }, [showReviewStage]);

  return (
    <LandmarkPopupProvider
      videoRef={videoRef}
      subscribeTrackingFrame={subscribeTrackingFrame}
    >
      {popupRequest && (
        <LandmarkPopupAutoOpen
          key={popupRequest.key}
          requestKey={popupRequest.key}
          variant={popupRequest.variant}
        />
      )}
      <main className="page calibration-page">
      <section className="card wide calibration-card">
        <header className="calibration-header">
          <div>
            <p className="calibration-kicker">Look Talk</p>
            <h1>{isRetestFlow ? '입력 방식 재측정' : '캘리브레이션'}</h1>
          </div>
        </header>

        {showStartPrompt && (
          <section className="calibration-placeholder" aria-live="polite">
            <p>16개 지점을 순서대로 응시해 시선-화면 매핑을 측정합니다.</p>
            <p>측정 중에는 브라우저 창의 LookTalk 페이지 영역 전체를 사용합니다(주소창/탭은 그대로 보입니다).</p>
            {cameraError && <p className="calibration-error">카메라 오류: {cameraError}</p>}
            <button type="button" className="calibration-start-button" onClick={startCalibration}>
              카메라로 캘리브레이션 시작
            </button>
          </section>
        )}

        {showLoading && (
          <section className="calibration-placeholder" aria-live="polite">
            <p>얼굴 인식 모델을 불러오는 중입니다…</p>
            {faceLoadError && <p className="calibration-error">불러오기 오류: {faceLoadError}</p>}
          </section>
        )}

        {/* 측정 중/완료 후에는 아래 full-viewport overlay가 화면을 덮으므로, 이 카드의
            내용은 측정 시작 전 안내로만 쓰인다. */}
        {!showMeasurementOverlay && (
          <button className="calibration-back-button" onClick={handleBackToAnalysis} type="button">
            분석 페이지로 돌아가기
          </button>
        )}
      </section>

      {/* FaceLandmarker 입력용 video. 화면에는 안 보이지만 재생 상태여야 detectForVideo가 동작한다. */}
      <video ref={videoRef} className="calibration-hidden-video" playsInline muted />

      {showMeasurementOverlay &&
        createPortal(
          <div className="calibration-measurement-overlay">
            {showCalibrationStage && progress.currentTarget && (
              <div
                className={`calibration-target calibration-target--${progress.pointStatus}`}
                style={{
                  left: `${progress.currentTarget.x * 100}%`,
                  top: `${progress.currentTarget.y * 100}%`,
                  ['--calibration-progress' as string]: progress.pointElapsedRatio,
                }}
              >
                <span className="calibration-target-ring" />
                <span className="calibration-target-dot" />
              </div>
            )}

            {showCalibrationStage && (
              <div className="calibration-overlay-status" aria-live="polite">
                <p>
                  {progress.pointIndex + 1} / {progress.totalPoints}번째 지점 —{' '}
                  {progress.pointStatus === 'stabilizing' ? '안정화 중' : '측정 중'} (
                  {formatPercent(progress.pointElapsedRatio)})
                </p>
                {progress.warning && <p className="calibration-warning">{progress.warning}</p>}
              </div>
            )}

            {showBlinkStage && blinkProgress && (
              <InputCalibrationPanel
                kind="blink"
                snapshot={blinkProgress}
                onRestart={restartBlink}
                onContinueWithDefaults={continueBlinkWithDefaults}
              />
            )}

            {showMouthStage && mouthProgress && (
              <InputCalibrationPanel
                kind="mouth"
                snapshot={mouthProgress}
                onRestart={restartMouth}
                onContinueWithDefaults={continueMouthWithDefaults}
              />
            )}

            {showInputTestStage && activeInputTest && (
              <InputMethodTestPanel
                key={flowStage}
                method={activeInputTest.method}
                targetWord={activeInputTest.targetWord}
                subscribeFrame={subscribeInputFrame}
                blinkCalibration={blinkProgress?.result ?? null}
                mouthCalibration={mouthProgress?.result ?? null}
                onComplete={completeInputTest}
              />
            )}

            {/* §10.1 — X/닫기, background click, ESC로 닫히지 않는다. 사용자는 입력 방식
                선택 또는 재측정 중 하나를 반드시 수행해야 하므로, 이 모달을 우회하는
                버튼(예: "분석 페이지로 돌아가기")은 두지 않는다. */}
            {showReviewStage && result && inputCalibration && !settingApplied && (
              <MeasurementResultModal
                candidate={result}
                pointDiagnostics={pointDiagnostics}
                subscribeCompletionGaze={subscribeCompletionGaze}
                inputCalibration={inputCalibration}
                inputTestResults={inputTestResults}
                onRetest={handleRetest}
                onSaving={markSaving}
                onSaveFailed={markSaveFailed}
                onApplied={handleApplied}
              />
            )}

            {/* §11 — 설정 저장이 실제로 성공한 뒤에만 표시. 확인 클릭 시 /analysis로 이동. */}
            {showCompleteStage && settingApplied && (
              <SettingCompleteModal
                subscribeCompletionGaze={subscribeCompletionGaze}
                onConfirm={handleSuccessConfirm}
              />
            )}

            {showResultCursor &&
              cursorNormalized &&
              (() => {
                const cssPx = viewportNormalizedToCssPx(cursorNormalized);
                return (
                  <div
                    className="calibration-cursor calibration-cursor--viewport"
                    style={{ left: `${cssPx.x}px`, top: `${cssPx.y}px` }}
                  />
                );
              })()}
          </div>,
          document.body,
        )}
      </main>
    </LandmarkPopupProvider>
  );
}
