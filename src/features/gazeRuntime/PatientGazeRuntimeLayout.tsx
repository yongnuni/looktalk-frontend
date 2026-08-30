import { Outlet } from 'react-router-dom';
import GazeCursorOverlay from '../gazeInteraction/GazeCursorOverlay';
import { GazeInteractionProvider } from '../gazeInteraction/GazeInteractionProvider';
import RealtimeMetricsLauncherButton from '../realtimeMetrics/RealtimeMetricsLauncherButton';
import { RealtimeMetricsBridge } from '../realtimeMetrics/RealtimeMetricsBridge';
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
 *
 * RealtimeMetricsBridge/RealtimeMetricsLauncherButton — Realtime Metrics Window(별도
 * 브라우저 창) 기능의 producer/launcher. GazeInteractionProvider의 자식으로 한 번만
 * 마운트해 hoveredTargetId/progress/mouthOpen을 그대로 재사용한다(새 계산 없음). UI가
 * 없는 Bridge와 corner의 작은 launcher 버튼뿐이라 페이지별 화면 구성에는 영향을 주지 않는다.
 */
export default function PatientGazeRuntimeLayout() {
  return (
    <GazeRuntimeProvider>
      <GazeInteractionProvider>
        <GazeCursorOverlay />
        <RealtimeMetricsBridge />
        <RealtimeMetricsLauncherButton />
        <Outlet />
      </GazeInteractionProvider>
    </GazeRuntimeProvider>
  );
}
