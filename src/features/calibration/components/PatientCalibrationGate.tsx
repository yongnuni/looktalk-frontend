import { Navigate, Outlet } from 'react-router-dom';
import { useActiveCalibration } from '../hooks/useActiveCalibration';
import { deriveCalibrationGateDecision } from '../calibrationGate';

/**
 * Front Step 10 — Calibration Bootstrap Gate.
 *
 * PATIENT route tree(§8 "가능하다면 Gate가 PATIENT route tree 전체를 감싸도록 한다")를
 * 감싸는 pathless layout route다. `/calibration` 자체는 이 Gate 밖의 형제 라우트로 남겨서
 * (router.tsx) "active 없음 → /calibration redirect → 그 /calibration도 다시 Gate를
 * 통과해야 함 → 무한 루프" 가능성을 구조적으로 차단한다(§8/§23).
 *
 * useActiveCalibration()이 이미 calibrationStore를 공유하므로(Front Step 5), 이 Gate가
 * 먼저 mount되어 status가 'loaded'가 된 뒤에만 <Outlet/>(예: PatientHomePage)이 mount된다
 * — 즉 자식이 같은 훅을 다시 불러도 status가 이미 'idle'이 아니라서 중복 GET이 발생하지
 * 않는다(§13, useActiveCalibration의 `status !== 'idle'` 가드).
 */
export default function PatientCalibrationGate() {
  const { status, error, refresh } = useActiveCalibration();
  const decision = deriveCalibrationGateDecision(status);

  if (decision === 'LOADING') {
    return (
      <main className="page">
        <section className="card">
          <p>캘리브레이션 정보를 확인하는 중입니다…</p>
        </section>
      </main>
    );
  }

  if (decision === 'CALIBRATION_REQUIRED') {
    return <Navigate to="/calibration" replace />;
  }

  if (decision === 'ERROR') {
    return (
      <main className="page">
        <section className="card">
          <p>활성 캘리브레이션 정보를 불러오지 못했습니다{error ? `: ${error}` : '.'}</p>
          <div className="button-group">
            <button type="button" onClick={() => void refresh()}>
              다시 시도
            </button>
          </div>
        </section>
      </main>
    );
  }

  // decision === 'READY'
  return <Outlet />;
}
