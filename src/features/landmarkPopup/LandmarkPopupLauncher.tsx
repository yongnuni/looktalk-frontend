import { useLandmarkPopup } from './LandmarkPopupContext';
import './LandmarkPopupLauncher.css';

export default function LandmarkPopupLauncher() {
  const { variant, open } = useLandmarkPopup();

  return (
    <div className="landmark-popup-launcher" aria-label="랜드마크 촬영 화면">
      <button
        type="button"
        className={variant === 'full' ? 'landmark-popup-launcher__button--active' : undefined}
        aria-pressed={variant === 'full'}
        onClick={() => open('full')}
      >
        전체 얼굴 랜드마크
      </button>
      <button
        type="button"
        className={variant === 'looktalk' ? 'landmark-popup-launcher__button--active' : undefined}
        aria-pressed={variant === 'looktalk'}
        onClick={() => open('looktalk')}
      >
        눈·홍채·입 랜드마크
      </button>
    </div>
  );
}
