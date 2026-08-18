import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useCalibrationStore } from '../../features/calibration/store/calibrationStore';
import { useGazeInput } from '../../features/multimodalInput/hooks/useGazeInput';
import type { KeyTarget } from '../../features/multimodalInput/types';
import './GazeDwellDebugPage.css';

const TEST_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function GazeDwellDebugPage() {
  const candidate = useCalibrationStore((state) => state.candidate);

  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [clickLog, setClickLog] = useState<string[]>([]);

  const getTargets = useCallback((): KeyTarget[] => {
    const targets: KeyTarget[] = [];

    buttonRefs.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      targets.push({
        id,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      });
    });

    return targets;
  }, []);

  // clickedKey(selectedKeyId) 발생을 로그로 기록 — Step 2 QA용. dwell이 확정되는 프레임에서
  // 직접 콜백을 받는다(렌더에서 파생된 값을 effect로 감시하는 방식 대신).
  const handleKeySelect = useCallback((keyId: string) => {
    setClickLog((prev) => [`${new Date().toLocaleTimeString()} — ${keyId}`, ...prev].slice(0, 10));
  }, []);

  const {
    permission,
    cameraError,
    videoRef,
    startInput,
    faceLoadState,
    faceLoadError,
    cursorCssPx,
    fixationCount,
    dwell,
    eyeClosed,
    trackingValid,
  } = useGazeInput({ calibration: candidate, getTargets, onKeySelect: handleKeySelect });

  return (
    <main className="page">
      <section className="card wide gaze-dwell-debug">
        <h1>Gaze Dwell Debug (Front Step 2)</h1>
        <p>
          제품 UI가 아니라 Eye-Closed Gate → GazeFilter → Dwell 파이프라인을 검증하기 위한
          개발용 화면입니다. QWERTY는 아직 없습니다(Step 3).
        </p>

        {!candidate && (
          <p className="gaze-dwell-debug-error">
            활성 캘리브레이션이 없습니다. 먼저{' '}
            <Link to="/calibration">/calibration</Link>에서 캘리브레이션을 완료하세요.
          </p>
        )}

        {candidate && (
          <>
            <div className="button-group">
              <button type="button" onClick={startInput} disabled={permission === 'granted' || permission === 'requesting'}>
                카메라 시작
              </button>
            </div>

            <p>카메라: <strong>{permission}</strong> / FaceLandmarker: <strong>{faceLoadState}</strong></p>
            {cameraError && <p className="gaze-dwell-debug-error">카메라 오류: {cameraError}</p>}
            {faceLoadError && <p className="gaze-dwell-debug-error">모델 오류: {faceLoadError}</p>}

            <dl className="gaze-dwell-debug-readout">
              <div><dt>trackingValid</dt><dd>{String(trackingValid)}</dd></div>
              <div><dt>eyeClosed</dt><dd>{String(eyeClosed)}</dd></div>
              <div><dt>fixationCount</dt><dd>{fixationCount}</dd></div>
              <div><dt>hoveredKey</dt><dd>{dwell.hoveredKeyId ?? '-'}</dd></div>
              <div><dt>dwell progress</dt><dd>{Math.round(dwell.progress * 100)}%</dd></div>
            </dl>

            <div className="gaze-dwell-debug-grid">
              {TEST_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  ref={(el) => {
                    if (el) buttonRefs.current.set(key, el);
                    else buttonRefs.current.delete(key);
                  }}
                  className={`gaze-dwell-debug-key${dwell.hoveredKeyId === key ? ' gaze-dwell-debug-key--hovered' : ''}`}
                  style={dwell.hoveredKeyId === key ? { ['--dwell-progress' as string]: dwell.progress } : undefined}
                  onClick={() => setClickLog((prev) => [`${new Date().toLocaleTimeString()} — ${key}(click)`, ...prev].slice(0, 10))}
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="gaze-dwell-debug-log">
              <h2>선택 로그</h2>
              <ul>
                {clickLog.map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <video ref={videoRef} className="gaze-dwell-debug-hidden-video" playsInline muted />

      {cursorCssPx &&
        createPortal(
          <div className="gaze-dwell-debug-cursor" style={{ left: `${cursorCssPx.x}px`, top: `${cursorCssPx.y}px` }} />,
          document.body,
        )}
    </main>
  );
}
