import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createOrGetHospitalChatRoom } from '../../features/chat/api/chatRooms';
import HospitalChatContactSearch from '../../features/chat/components/HospitalChatContactSearch';
import VirtualKeyboard from '../../features/keyboard/components/VirtualKeyboard';
import { useKeyboardInput } from '../../features/keyboard/hooks/useKeyboardInput';
import { useKeyboardGazeTargets } from '../../features/keyboard/useKeyboardGazeTargets';
import { useGazeRuntime } from '../../features/gazeRuntime/GazeRuntimeContext';
import { useGazeInteraction } from '../../features/gazeInteraction/GazeInteractionContext';
import { usePageScope } from '../../features/gazeInteraction/usePageScope';
import { resolveGazeInputMode } from '../../features/multimodalInput/gazeInputMode';
import { useUserSettings } from '../../features/userSetting/hooks/useUserSettings';
import './PatientHomePage.css';

export default function PatientHomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isHospitalSearch = searchParams.get('source') === 'hospital-search';

  const [hospitalSearchKeyword, setHospitalSearchKeyword] = useState<string | null>(null);
  const [hospitalSearchPage, setHospitalSearchPage] = useState(0);
  const [hospitalSearchRequestId, setHospitalSearchRequestId] = useState(0);

  const handleHospitalContactSearch = useCallback((composedText: string) => {
    const keyword = composedText.trim();
    if (!keyword) return;

    setHospitalSearchKeyword(keyword);
    setHospitalSearchPage(0);
    setHospitalSearchRequestId((current) => current + 1);
  }, []);

  const handleHospitalContactSelect = async (targetUserId: string) => {
    const { roomId } = await createOrGetHospitalChatRoom(targetUserId);
    navigate(`/chat/hospital?roomId=${roomId}`);
  };

  // useKeyboardInput()이 반환하는 clearText는 handleConfirm보다 나중에 생기므로(순환
  // 참조), ref로 최신 함수를 받아둔다 — onFrameRef 등과 동일한 패턴.
  const clearTextRef = useRef<() => void>(() => {});

  // Integration Plan §15.4: VirtualKeyboard의 '확인'은 onConfirm(composedText) 콜백을
  // 트리거할 뿐, 실제 전송/검색 동작은 이 페이지가 결정한다 — 기존 ENTER 기반
  // handleSend/병원검색 흐름을 여기로 이전했다(Front Step 3-4).
  const handleConfirm = useCallback(
    (composedText: string) => {
      if (isHospitalSearch) {
        handleHospitalContactSearch(composedText);
        return;
      }

      if (!composedText.trim()) {
        alert('전송할 문장이 없습니다.');
        return;
      }

      alert(`전송할 문장: ${composedText}`);
      clearTextRef.current();
    },
    [isHospitalSearch, handleHospitalContactSearch],
  );

  const { keyboardState, text, handleKeySelect, clearText } = useKeyboardInput({ onConfirm: handleConfirm });

  useEffect(() => {
    clearTextRef.current = clearText;
  }, [clearText]);

  // UserSetting GET은 페이지 진입 시 1회(useUserSettings 내부에서 store 공유로 중복 방지),
  // PATCH는 실제 설정 변경 UI(캘리브레이션 결과 모달 등)에서만 호출한다(Front Step 4).
  const { settings: userSettings } = useUserSettings();

  // Front Step 8/9/11 — currentInputMethod에 따른 입력 방식 전환(resolveGazeInputMode).
  // 이 값은 GazeInteractionProvider(Front Step 12) 안에서도 동일하게 계산되어 전역
  // DwellController/MouthController에 이미 적용되어 있다 — 여기서는 표시용으로만 쓴다.
  const gazeInputMode = resolveGazeInputMode(userSettings?.currentInputMethod);

  // Front Step 11: Camera/FaceLandmarker/Homography/GazeFilter는 더 이상 이 페이지가
  // 소유하지 않는다 — PatientGazeRuntimeLayout(router.tsx) 안의 GazeRuntimeProvider가
  // PATIENT route tree 전체에서 하나만 실행하는 Global Runtime을 여기서는 구독만 한다.
  const { permission, startInput, faceLoadState, trackingValid, compatibility } = useGazeRuntime();
  const keyboardContainerRef = useRef<HTMLDivElement | null>(null);

  // Front Step 16 §16 — `/patient`는 실제 서비스 Main이 아니라 VirtualKeyboard 통합/회귀
  // QA route다. 더 이상 자신만의 로컬 useGazeSelection(별도 DwellController/
  // MouthController 인스턴스)을 쓰지 않고, Chat과 동일하게 Global GazeInteractionProvider의
  // KEYBOARD scope + registry에 key를 등록해 Global selection engine 단 하나만 쓴다(§36).
  usePageScope('KEYBOARD');
  const { hoveredTargetId, progress: dwellProgress } = useGazeInteraction();
  const layoutSignature = `${keyboardState.isKorean}-${keyboardState.isShift}`;
  useKeyboardGazeTargets(keyboardContainerRef, handleKeySelect, layoutSignature);

  // useKeyboardGazeTargets가 등록하는 target id는 `keyboard:${value}` 접두사가 붙는다
  // (여러 화면이 같은 key 값을 동시에 등록할 수 있어 registry key 충돌을 피하기 위함,
  // useKeyboardGazeTargets.ts 참고) — VirtualKeyboard에는 원래 key 값만 넘긴다.
  const hoveredKeyValue = hoveredTargetId?.startsWith('keyboard:') ? hoveredTargetId.slice('keyboard:'.length) : null;

  return (
    <main className="page">
      <section className="card wide">
        <header className="page-header">
          <div>
            <h1>환자 메인</h1>
            <p>가상키보드 입력 화면입니다. 마우스 클릭 또는 시선으로 입력할 수 있습니다.</p>
          </div>

          <nav className="nav-links">
            <Link to="/memo">개인 메모장</Link>
            <Link to="/chat/hospital">병원 채팅</Link>
            <Link to="/chat/friend">친구 채팅</Link>
            <Link to="/analysis">분석</Link>
            <Link to="/mypage">마이페이지</Link>
            <Link to="/calibration">캘리브레이션</Link>
          </nav>
        </header>

        {/* Front Step 10: PatientCalibrationGate가 이 페이지 진입 전에 이미 active
            calibration 존재를 보장하므로, 여기서는 loading/error/미존재 분기를 다시 두지
            않는다(§14) — active는 항상 non-null이다. */}
        <div className="patient-home-gaze-status">
          {compatibility && compatibility.status !== 'compatible' && (
            <p className="patient-home-compatibility-banner">
              화면 크기/방향이 캘리브레이션 당시와 달라졌습니다. 시선 입력 정확도가 낮다면{' '}
              <Link to="/calibration?mode=retest&source=analysis">재측정</Link>을 권장합니다.
            </p>
          )}
          {permission !== 'granted' && (
            <button type="button" onClick={startInput}>
              시선 입력 시작
            </button>
          )}
          {permission === 'granted' && (
            <p>
              입력 방식: <strong>{gazeInputMode === 'MOUTH' ? '입 움직임' : '시선(dwell)'}</strong> / FaceLandmarker:{' '}
              <strong>{faceLoadState}</strong> / 추적: <strong>{String(trackingValid)}</strong>
            </p>
          )}
        </div>

        <textarea
          className="message-box"
          value={text}
          readOnly
          placeholder="가상키보드로 문장을 입력하세요."
        />

        <div ref={keyboardContainerRef}>
          <VirtualKeyboard
            keyboardState={keyboardState}
            hoveredKeyId={hoveredKeyValue}
            dwellProgress={dwellProgress}
            onKeySelect={handleKeySelect}
            keyEnlarged={userSettings?.keyEnlarged ?? false}
          />
        </div>

        {isHospitalSearch && hospitalSearchKeyword ? (
          <HospitalChatContactSearch
            keyword={hospitalSearchKeyword}
            page={hospitalSearchPage}
            requestId={hospitalSearchRequestId}
            onContactSelect={handleHospitalContactSelect}
            onPageChange={setHospitalSearchPage}
          />
        ) : null}
      </section>

      {/* Front Step 11: hidden <video>는 더 이상 이 페이지가 렌더링하지 않는다 —
          GazeRuntimeProvider가 소유/렌더링한다(카메라는 Runtime만 소유, §13/§27).
          Front Step 12: gaze cursor도 더 이상 이 페이지가 렌더링하지 않는다 —
          PatientGazeRuntimeLayout의 GazeCursorOverlay가 PATIENT 전체에서 하나만
          그린다(§5/§8, 로컬 cursor 제거). */}
    </main>
  );
}
