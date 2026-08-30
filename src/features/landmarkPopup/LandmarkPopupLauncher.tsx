import { useLandmarkPopup } from './LandmarkPopupContext';
import './LandmarkPopupLauncher.css';

export default function LandmarkPopupLauncher() {
  const { needsUserOpen, reopen, variant } = useLandmarkPopup();

  if (!variant || !needsUserOpen) {
    return null;
  }

  return (
    <div className="landmark-popup-launcher" aria-label="랜드마크 촬영 화면">
      <button type="button" onClick={reopen}>
        랜드마크 창 열기
      </button>
    </div>
  );
}
