import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isRealtimeMetricsWindowOpen, openRealtimeMetricsWindow } from './openRealtimeMetricsWindow';
import './RealtimeMetricsLauncherButton.css';

// "팝업이 닫혔는지" 확인용 저빈도 polling 주기. 매 frame 체크하지 않는다.
const POLL_INTERVAL_MS = 750;

/**
 * "실시간 분석 창 열기" — 영상 촬영/개발 확인용으로 명확히 분리된 최소 launcher.
 * Patient runtime(PatientGazeRuntimeLayout)과 Calibration(CalibrationPage)이 이 컴포넌트를
 * 각각 한 번씩만 마운트한다 — 두 route는 서로 배타적으로만 렌더링되므로(react-router가
 * 한 순간에 하나의 route element tree만 마운트) 동시에 두 launcher가 DOM에 존재할 수 없다.
 *
 * mount 시 자동으로 팝업을 열지 않는다(브라우저 popup blocker 회피) — 반드시 클릭(사용자
 * gesture)에서만 window.open()을 호출한다.
 *
 * 팝업이 열려 있는 동안은 본 화면에서 완전히 숨긴다(return null) — 단, 컴포넌트 자체는
 * 계속 마운트된 채로 남아 있어야 polling으로 "사용자가 팝업을 닫았다"를 감지해 다시
 * 나타날 수 있다(early return은 hook 호출 이후에만 하므로 Rules of Hooks에 위배되지 않는다).
 *
 * document.body에 createPortal로 렌더링한다(GazeCursorOverlay.tsx/CalibrationPage.tsx의
 * 측정용 커서와 동일한 기존 패턴 재사용) — 실제 브라우저에서 확인한 원인: 전역 CSS
 * 번들에 `#root { overflow: hidden }`(SignupPage.css 등 여러 페이지가 각자 넣어 둔
 * `#root` 리셋 규칙 중 하나 — 같은 우선순위의 다른 규칙들은 overflow를 아예 건드리지
 * 않아 이 값이 절대 덮어써지지 않는다, `npm run build` 결과물 dist/assets/index-*.css로
 * 직접 확인)가 항상 활성 상태였다. #root 하위 트리 안에 있으면, 페이지마다 달라지는
 * 실제 렌더 높이/중첩 구조에 따라 이 launcher(position:fixed)가 그 #root 박스에 clip돼
 * 안 보일 수 있다 — z-index를 아무리 올려도 clip 자체를 막지는 못한다. document.body로
 * portal하면 #root의 overflow/스택 컨텍스트 자체를 완전히 벗어나므로 어떤 route에
 * 마운트되든 항상 동일하게 보인다.
 */
export default function RealtimeMetricsLauncherButton() {
  const [popupOpen, setPopupOpen] = useState(() => isRealtimeMetricsWindowOpen());
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPopupOpen(isRealtimeMetricsWindowOpen());
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  const handleClick = () => {
    const result = openRealtimeMetricsWindow();
    setBlocked(result === 'blocked');
    setPopupOpen(result === 'opened' || result === 'focused');
  };

  if (popupOpen) {
    return null;
  }

  return createPortal(
    <div className="realtime-metrics-launcher">
      <button
        type="button"
        className="realtime-metrics-launcher__button"
        onClick={handleClick}
        title="시선/눈/입 실시간 분석값을 별도 창으로 표시합니다"
      >
        실시간 분석 창 열기
      </button>
      {blocked && (
        <p className="realtime-metrics-launcher__warning" role="alert">
          팝업이 차단되었습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도하세요.
        </p>
      )}
    </div>,
    document.body,
  );
}
