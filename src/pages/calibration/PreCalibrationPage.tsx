import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { useCalibrationCompletionGaze } from '../../features/calibration/completionGaze/useCalibrationCompletionGaze';
import { useCalibrationRunner } from '../../features/calibration/hooks/useCalibrationRunner';
import { viewportNormalizedToCssPx } from '../../features/calibration/viewportTargets';
import { ROUTES } from '../../shared/constants/routes';

import './CalibrationPage.css';

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export default function PreCalibrationPage() {
  const navigate = useNavigate();

  const {
    permission,
    cameraError,
    videoRef,
    startCalibration,
    faceLoadState,
    faceLoadError,
    progress,
    result,
    cursorNormalized,
    subscribeCompletionGaze,
    restart,
  } = useCalibrationRunner({
    mode: 'pre',
  });

  const showStartPrompt = permission !== 'granted';

  const showLoading = permission === 'granted' && faceLoadState !== 'ready';

  const showMeasurementOverlay =
    permission === 'granted' && faceLoadState === 'ready';

  const showCalibrationStage = showMeasurementOverlay && !progress.done;

  const showResultStage =
    showMeasurementOverlay && progress.done && result !== null;

  const retestButtonRef = useRef<HTMLButtonElement | null>(null);
  const loginButtonRef = useRef<HTMLButtonElement | null>(null);
  const completionActionStartedRef = useRef(false);

  // =========================================================
  // 다시 측정
  // =========================================================

  const handleRetest = useCallback(() => {
    if (completionActionStartedRef.current) {
      return;
    }

    completionActionStartedRef.current = true;
    restart();
  }, [restart]);

  // =========================================================
  // 로그인으로 이동
  // =========================================================
  //
  // 로그인 전 측정 결과는 아직 특정 사용자 계정에 연결할 수 없으므로
  // sessionStorage에 임시 저장한다.
  //
  // 로그인 성공 후 필요하면 이 값을 읽어 Backend에 연결할 수 있다.
  // =========================================================

  const handleContinueToLogin = useCallback(() => {
    if (!result) {
      return;
    }

    if (completionActionStartedRef.current) {
      return;
    }

    completionActionStartedRef.current = true;

    sessionStorage.setItem('preCalibrationResult', JSON.stringify(result));

    sessionStorage.setItem('preCalibrationCompleted', 'true');

    navigate(ROUTES.LOGIN, {
      replace: true,
    });
  }, [navigate, result]);

  useEffect(() => {
    if (!showResultStage) {
      completionActionStartedRef.current = false;
    }
  }, [showResultStage]);

  const getCompletionTargets = useCallback(
    () => [
      {
        id: 'pre-calibration-retest',
        element: retestButtonRef.current,
        enabled: showResultStage,
        onSelect: handleRetest,
      },
      {
        id: 'pre-calibration-login',
        element: loginButtonRef.current,
        enabled: showResultStage,
        onSelect: handleContinueToLogin,
      },
    ],
    [handleContinueToLogin, handleRetest, showResultStage],
  );

  useCalibrationCompletionGaze({
    active: showResultStage,
    subscribe: subscribeCompletionGaze,
    getTargets: getCompletionTargets,
  });

  return (
    <main className="page calibration-page">
      <section className="card wide calibration-card">
        <header className="calibration-header">
          <div>
            <p className="calibration-kicker">Look Talk</p>

            <h1>시선 사전 캘리브레이션</h1>
          </div>
        </header>

        {/* ===================================================
            시작 안내
        =================================================== */}

        {showStartPrompt && (
          <section className="calibration-placeholder" aria-live="polite">
            <p>9개 지점을 순서대로 응시해 시선-화면 매핑을 측정합니다.</p>

            <p>
              측정 중에는 브라우저 창의 Look Talk 페이지 영역 전체를 사용합니다.
              주소창과 탭은 그대로 보입니다.
            </p>

            {cameraError && (
              <p className="calibration-error">카메라 오류: {cameraError}</p>
            )}

            <button
              type="button"
              className="calibration-start-button"
              onClick={startCalibration}
            >
              카메라로 9점 캘리브레이션 시작
            </button>
          </section>
        )}

        {/* ===================================================
            FaceLandmarker Loading
        =================================================== */}

        {showLoading && (
          <section className="calibration-placeholder" aria-live="polite">
            <p>얼굴 인식 모델을 불러오는 중입니다…</p>

            {faceLoadError && (
              <p className="calibration-error">
                불러오기 오류: {faceLoadError}
              </p>
            )}
          </section>
        )}
      </section>

      {/* =====================================================
          FaceLandmarker 입력용 Video
      ===================================================== */}

      <video
        ref={videoRef}
        className="calibration-hidden-video"
        playsInline
        muted
      />

      {/* =====================================================
          Full Viewport Calibration
      ===================================================== */}

      {showMeasurementOverlay &&
        createPortal(
          <div className="calibration-measurement-overlay">
            {/* ===============================================
                9점 측정 Target
            =============================================== */}

            {showCalibrationStage && progress.currentTarget && (
              <div
                className={`calibration-target calibration-target--${progress.pointStatus}`}
                style={{
                  left: `${progress.currentTarget.x * 100}%`,
                  top: `${progress.currentTarget.y * 100}%`,
                  ['--calibration-progress' as string]:
                    progress.pointElapsedRatio,
                }}
              >
                <span className="calibration-target-ring" />

                <span className="calibration-target-dot" />
              </div>
            )}

            {/* ===============================================
                측정 진행 상태
            =============================================== */}

            {showCalibrationStage && (
              <div className="calibration-overlay-status" aria-live="polite">
                <p>
                  {progress.pointIndex + 1} / {progress.totalPoints}번째 지점 —{' '}
                  {progress.pointStatus === 'stabilizing'
                    ? '안정화 중'
                    : '측정 중'}{' '}
                  ({formatPercent(progress.pointElapsedRatio)})
                </p>

                {progress.warning && (
                  <p className="calibration-warning">{progress.warning}</p>
                )}
              </div>
            )}

            {/* ===============================================
                측정 완료
            =============================================== */}

            {showResultStage && (
              <div className="calibration-overlay-status calibration-overlay-status--result">
                <h2>9점 캘리브레이션이 완료되었습니다.</h2>

                <p className="calibration-rmse">
                  측정 오차(RMSE):{' '}
                  {result.reprojectionRmseNormalized.toFixed(4)}
                </p>

                <p>계속 진행하면 로그인 화면으로 이동합니다.</p>

                <div className="calibration-overlay-actions">
                  <button
                    ref={retestButtonRef}
                    type="button"
                    className="calibration-back-button"
                    onClick={handleRetest}
                  >
                    다시 측정
                  </button>

                  <button
                    ref={loginButtonRef}
                    type="button"
                    className="calibration-start-button"
                    onClick={handleContinueToLogin}
                  >
                    로그인으로 이동
                  </button>
                </div>
              </div>
            )}

            {/* ===============================================
                측정 완료 후 Gaze Cursor
            =============================================== */}

            {showResultStage &&
              cursorNormalized &&
              (() => {
                const cssPx = viewportNormalizedToCssPx(cursorNormalized);

                return (
                  <div
                    className="calibration-cursor calibration-cursor--viewport"
                    style={{
                      left: `${cssPx.x}px`,
                      top: `${cssPx.y}px`,
                    }}
                  />
                );
              })()}
          </div>,
          document.body,
        )}
    </main>
  );
}
