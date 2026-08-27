import { Outlet } from 'react-router-dom';
import GazeCursorOverlay from '../gazeInteraction/GazeCursorOverlay';
import { GazeInteractionProvider } from '../gazeInteraction/GazeInteractionProvider';
import { LandmarkPopupProvider } from '../landmarkPopup/LandmarkPopupProvider';
import { GazeRuntimeProvider } from './GazeRuntimeProvider';

/**
 * Front Step 11/12 — router.tsx에서 PatientCalibrationGate의 자식으로 배치되는 pathless
 * layout route. Gate가 READY(active calibration 존재)로 판정한 뒤에만 이 layout이
 * mount되고, 그 안에서만 GazeRuntimeProvider(Camera/FaceLandmarker/GazeFilter, Step 11)와
 * GazeInteractionProvider(Target Registry + Dwell/Mouth selection, Step 12)가 산다.
 *
 * `/calibration`은 Gate 밖의 형제 route라 이 layout을 절대 거치지 않는다 — 두 camera
 * runtime이 동시에 존재할 수 없다는 invariant, 그리고 Global Cursor가 CalibrationPage
 * 위에 동시에 뜨지 않는다는 §38 요구사항이 router 구조만으로 보장된다.
 *
 * GazeCursorOverlay는 여기서 한 번만 렌더링한다 — 페이지마다 자기 cursor를 만들지 않는다
 * (§5, §8).
 */
export default function PatientGazeRuntimeLayout() {
  return (
    <GazeRuntimeProvider>
      <LandmarkPopupProvider>
        <GazeInteractionProvider>
          <GazeCursorOverlay />
          <Outlet />
        </GazeInteractionProvider>
      </LandmarkPopupProvider>
    </GazeRuntimeProvider>
  );
}
