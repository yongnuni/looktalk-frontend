import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  isRealtimeMetricsWindowOpen,
  openRealtimeMetricsWindow,
} from './openRealtimeMetricsWindow';
import './RealtimeMetricsLauncherButton.css';

// 실시간 분석 팝업 및 실행 버튼 사용 여부
// false: 팝업과 실행 버튼 모두 숨김
// true: 기존 팝업 및 버튼 기능 활성화
const ENABLE_REALTIME_METRICS_POPUP = false;

// 팝업이 닫혔는지 확인하는 polling 주기
const POLL_INTERVAL_MS = 750;

export default function RealtimeMetricsLauncherButton() {
  const [popupOpen, setPopupOpen] = useState(() =>
    isRealtimeMetricsWindowOpen(),
  );
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    // 팝업 기능이 OFF이면 polling도 실행하지 않는다.
    if (!ENABLE_REALTIME_METRICS_POPUP) {
      return;
    }

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

  // 팝업 기능이 OFF이면 실행 버튼 자체를 렌더링하지 않는다.
  if (!ENABLE_REALTIME_METRICS_POPUP) {
    return null;
  }

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
