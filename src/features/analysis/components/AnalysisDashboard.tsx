import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Keyboard from '../../../assets/keyboard.png';
import LeftArrow from '../../../assets/left_arrow.png';
import Logo from '../../../assets/Logo.png';
import RightArrow from '../../../assets/right_arrow.png';
import Robot from '../../../assets/robot.png';
import Setting from '../../../assets/setting.png';
import Sos from '../../../assets/sos.png';
import BaseModal from '../../../shared/components/modal/BaseModal';
import { ROUTES } from '../../../shared/constants/routes';
import { useGazeInteraction } from '../../gazeInteraction/GazeInteractionContext';
import { usePageScope } from '../../gazeInteraction/usePageScope';
import { useGazeTarget } from '../../gazeInteraction/useGazeTarget';
import { useUserSettings } from '../../userSetting/hooks/useUserSettings';
import { mapInputMethodIdToBackend } from '../inputMethodMapping';
import { analysisItems, initialAnalysis } from '../mock/analysisMock';
import type { AnalysisItem, InputMethodId } from '../types/analysis';
import MetricDonut from './MetricDonut';
import InputMethodSelectionModal from './InputMethodSelectionModal';
import './AnalysisDashboard.css';

type ModalKind =
  | 'input-choice'
  | 'input-selection'
  | 'retest-intro'
  | 'change-success'
  | 'emergency-countdown'
  | 'emergency-complete'
  | null;

export default function AnalysisDashboard() {
  const navigate = useNavigate();
  usePageScope('MAIN');
  const { setActiveScope } = useGazeInteraction();
  const [searchParams] = useSearchParams();
  const requestedInputId = searchParams.get('input') as InputMethodId | null;
  const requestedAnalysisIndex = analysisItems.findIndex((item) => item.id === requestedInputId);
  const initialIndex = requestedAnalysisIndex >= 0 ? requestedAnalysisIndex : 0;
  const [analysisIndex, setAnalysisIndex] = useState(initialIndex);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisItem>(analysisItems[initialIndex] ?? initialAnalysis);
  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [countdown, setCountdown] = useState(5);

  // Front Step 17 §14/§17 BUG C/D/E — InputMethodSelectionModal의 선택이 실제 Backend
  // UserSetting에 저장되도록 하는 상태. MeasurementResultModal(Calibration 흐름, 이미
  // 정상 동작)과 동일하게 저장 성공 후에만 완료 모달로 넘어가고, 실패 시 에러를 보여주고
  // 선택 모달에 머무른다(§30 error visibility).
  const { updateSettings } = useUserSettings();
  const [isSavingInputMethod, setIsSavingInputMethod] = useState(false);
  const [inputMethodError, setInputMethodError] = useState<string | null>(null);

  const moveAnalysis = (direction: -1 | 1) => {
    const nextIndex = (analysisIndex + direction + analysisItems.length) % analysisItems.length;
    setAnalysisIndex(nextIndex);
    setActiveAnalysis(analysisItems[nextIndex]);
  };

  // Front Step 17 §14/§17/§25 — 실제 저장 지점. MeasurementResultModal과 동일하게
  // useUserSettings().updateSettings(...)만 사용한다(§18, 두 곳이 같은 저장 계약을
  // 공유). BLINK도 disabled 처리하지 않고 그대로 저장한다 — "아직 런타임 구현이 없으니
  // 선택 자체를 막는다"는 잘못된 접근이라는 §25 지침을 그대로 따른다. 저장 성공 후에만
  // (그리고 그때만) 아래 목업 분석 패널(analysisItems)도 함께 바꾼다 — 이 부분은 여전히
  // InputSession/Recommendation이 Backend에 없어 목업이며(§49 KNOWN_LIMITATION), 이번
  // 수정 범위는 "선택이 실제로 저장되는가"이지 분석 지표 자체의 실제화가 아니다.
  const handleSelectInputMethod = async (inputMethodId: InputMethodId) => {
    if (isSavingInputMethod) return;

    setIsSavingInputMethod(true);
    setInputMethodError(null);

    try {
      await updateSettings({ currentInputMethod: mapInputMethodIdToBackend(inputMethodId) });

      const nextIndex = analysisItems.findIndex((item) => item.id === inputMethodId);
      if (nextIndex >= 0) {
        setAnalysisIndex(nextIndex);
        setActiveAnalysis(analysisItems[nextIndex]);
      }

      setModalKind('change-success');
    } catch (error) {
      console.error('입력 방식 저장 실패:', error);
      setInputMethodError('입력 방식을 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSavingInputMethod(false);
    }
  };

  useEffect(() => {
    if (modalKind !== 'emergency-countdown') return;

    const timer = window.setTimeout(() => {
      if (countdown <= 1) {
        setModalKind('emergency-complete');
        return;
      }

      setCountdown((currentCountdown) => currentCountdown - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown, modalKind]);

  const openEmergency = () => {
    setCountdown(5);
    setModalKind('emergency-countdown');
  };

  const closeModal = () => setModalKind(null);

  // Front Step 15 §30/§34 — 모달이 열려 있는 동안 MODAL scope로 전환해 뒤쪽 화면이 gaze로
  // 선택되지 않게 한다. 이 페이지의 Emergency countdown/complete는 Chat과 마찬가지로
  // 이 페이지에 국한된 별도 mock 구현이라(공용 EmergencyButton이 아님) 이번 범위에서는
  // 트리거를 포함해 gaze 미지원으로 남긴다(최종 보고 KNOWN_LIMITATION).
  useEffect(() => {
    setActiveScope(modalKind === null ? 'MAIN' : 'MODAL');
  }, [modalKind, setActiveScope]);

  const settingsTargetRef = useGazeTarget({ id: 'analysis-settings', scope: 'MAIN', onSelect: () => navigate('/mypage') });
  const hospitalChatTargetRef = useGazeTarget({ id: 'analysis-chat-hospital', scope: 'MAIN', onSelect: () => navigate('/chat/hospital') });
  const friendChatTargetRef = useGazeTarget({ id: 'analysis-chat-friend', scope: 'MAIN', onSelect: () => navigate('/chat/friend') });
  const prevAnalysisTargetRef = useGazeTarget({ id: 'analysis-prev', scope: 'MAIN', onSelect: () => moveAnalysis(-1) });
  const nextAnalysisTargetRef = useGazeTarget({ id: 'analysis-next', scope: 'MAIN', onSelect: () => moveAnalysis(1) });
  // §30 — Calibration 재측정 entry point. 기존 action(input-choice 모달 오픈)을 그대로 쓴다.
  const retestEntryTargetRef = useGazeTarget({ id: 'analysis-retest-entry', scope: 'MAIN', onSelect: () => setModalKind('input-choice') });

  const inputChoiceChangeTargetRef = useGazeTarget({
    id: 'analysis-modal-input-choice-change',
    scope: 'MODAL',
    enabled: modalKind === 'input-choice',
    onSelect: () => setModalKind('input-selection'),
  });
  const inputChoiceCancelTargetRef = useGazeTarget({
    id: 'analysis-modal-input-choice-cancel',
    scope: 'MODAL',
    enabled: modalKind === 'input-choice',
    onSelect: closeModal,
  });
  const retestStartTargetRef = useGazeTarget({
    id: 'analysis-modal-retest-start',
    scope: 'MODAL',
    enabled: modalKind === 'retest-intro',
    onSelect: () => navigate('/calibration?mode=retest&source=analysis'),
  });
  const retestCancelTargetRef = useGazeTarget({
    id: 'analysis-modal-retest-cancel',
    scope: 'MODAL',
    enabled: modalKind === 'retest-intro',
    onSelect: closeModal,
  });
  const changeSuccessConfirmTargetRef = useGazeTarget({
    id: 'analysis-modal-change-success-confirm',
    scope: 'MODAL',
    enabled: modalKind === 'change-success',
    onSelect: closeModal,
  });

  return (
    <main className="analysis-page">
      <div className="analysis-shell">
        <header className="analysis-header">
          <Link className="analysis-header__brand" to={ROUTES.MAIN} aria-label="Look Talk 메인 페이지로 이동">
            <img className="analysis-header__brand-image" src={Logo} alt="Look Talk 로고" />
          </Link>

          <div className="analysis-header__navigation">
            <button
              ref={settingsTargetRef}
              aria-label="설정 페이지로 이동"
              className="analysis-icon-button analysis-icon-button--settings"
              onClick={() => navigate('/mypage')}
              type="button"
            >
              <img src={Setting} alt="" />
            </button>
            <button ref={hospitalChatTargetRef} className="analysis-header-button" onClick={() => navigate('/chat/hospital')} type="button">
              병원 채팅으로 이동
            </button>
            <button ref={friendChatTargetRef} className="analysis-header-button" onClick={() => navigate('/chat/friend')} type="button">
              친구 채팅으로 이동
            </button>
          </div>

          <button
            aria-label="비상호출"
            className="analysis-icon-button analysis-icon-button--emergency"
            onClick={openEmergency}
            type="button"
          >
            <img src={Sos} alt="" />
          </button>
        </header>

        <section className="analysis-intro" aria-labelledby="analysis-title">
          <h1 id="analysis-title" className="analysis-intro__recommendation">
            <img className="analysis-intro__robot" src={Robot} alt="" />
            <span>추천 입력 방식: “{activeAnalysis.recommendedMethod}”</span>
          </h1>
          <p className="analysis-intro__current">&lt;{activeAnalysis.inputMethod}&gt;</p>
        </section>

        <section className="analysis-metrics" aria-label={`${activeAnalysis.inputMethod} 분석 지표`}>
          {activeAnalysis.metrics.map((metric) => (
            <MetricDonut key={metric.id} metric={metric} />
          ))}
        </section>

        <nav className="analysis-controls" aria-label="분석 항목 이동">
          <button
            ref={prevAnalysisTargetRef}
            aria-label="이전 입력 방식 분석 보기"
            className="analysis-control-button analysis-control-button--arrow"
            onClick={() => moveAnalysis(-1)}
            type="button"
          >
            <img src={LeftArrow} alt="" />
          </button>
          <button
            ref={retestEntryTargetRef}
            aria-label="입력 방식 변경 또는 재검사"
            className="analysis-control-button analysis-control-button--keyboard"
            onClick={() => setModalKind('input-choice')}
            type="button"
          >
            <img src={Keyboard} alt="" />
          </button>
          <button
            ref={nextAnalysisTargetRef}
            aria-label="다음 입력 방식 분석 보기"
            className="analysis-control-button analysis-control-button--arrow"
            onClick={() => moveAnalysis(1)}
            type="button"
          >
            <img src={RightArrow} alt="" />
          </button>
        </nav>
      </div>

      <BaseModal
        actions={[
          { label: '변경하기', onClick: () => setModalKind('input-selection'), tone: 'positive', gazeTargetRef: inputChoiceChangeTargetRef },
          { label: '취소', onClick: closeModal, tone: 'neutral', gazeTargetRef: inputChoiceCancelTargetRef },
        ]}
        isOpen={modalKind === 'input-choice'}
        onClose={closeModal}
      >
        <p>
          입력 방식을 변경하시겠습니까?
          <br />
          현재 추천 입력 방식은 “{activeAnalysis.recommendedMethod}”입니다.
        </p>
      </BaseModal>

      <BaseModal
        actions={[
          {
            label: '검사 시작',
            onClick: () => navigate('/calibration?mode=retest&source=analysis'),
            tone: 'positive',
            gazeTargetRef: retestStartTargetRef,
          },
          { label: '취소', onClick: closeModal, tone: 'neutral', gazeTargetRef: retestCancelTargetRef },
        ]}
        isOpen={modalKind === 'retest-intro'}
        onClose={closeModal}
      >
        <p>
          사용자 맞춤 추천을 위해 입력 방식 재측정을 시작합니다.
          <br /><br />
          시선, 눈 깜빡임, 입 움직임 검사가 순서대로 진행됩니다.
          <br /><br />
          Look Talk은 사용자의 얼굴 데이터를 저장하지 않습니다.
        </p>
      </BaseModal>

      <BaseModal
        actions={[{ label: '확인', onClick: closeModal, tone: 'neutral', gazeTargetRef: changeSuccessConfirmTargetRef }]}
        isOpen={modalKind === 'change-success'}
        onClose={closeModal}
      >
        <p>입력 방식이 변경되었습니다.</p>
        <p className="analysis-modal-supporting-text">자세한 분석 결과는 분석페이지를 참고하세요!</p>
      </BaseModal>

      <BaseModal
        actions={[{ label: '취소', onClick: closeModal, tone: 'neutral' }]}
        isOpen={modalKind === 'emergency-countdown'}
        onClose={closeModal}
      >
        <p>응답이 없을 경우 5초 후 비상호출이 전송됩니다.</p>
        <strong className="base-modal-countdown" aria-live="polite">{countdown}</strong>
      </BaseModal>

      <BaseModal
        actions={[{ label: '확인', onClick: closeModal, tone: 'neutral' }]}
        isOpen={modalKind === 'emergency-complete'}
        variant="emergency"
        onClose={closeModal}
      >
        <p>달려오고 있어요! 조금만 기다려주세요!</p>
      </BaseModal>

      <InputMethodSelectionModal
        isOpen={modalKind === 'input-selection'}
        isSaving={isSavingInputMethod}
        errorMessage={inputMethodError}
        onRetest={() => {
          setInputMethodError(null);
          setModalKind('retest-intro');
        }}
        onSelect={(inputMethodId) => void handleSelectInputMethod(inputMethodId)}
      />
    </main>
  );
}
