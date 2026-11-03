import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Logo from '../../../assets/Logo.png';
import Setting from '../../../assets/setting.png';

import BaseModal from '../../../shared/components/modal/BaseModal';
import { ROUTES } from '../../../shared/constants/routes';
import EmergencyButton from '../../emergency/components/EmergencyButton';
import { useGazeInteraction } from '../../gazeInteraction/GazeInteractionContext';
import { usePageScope } from '../../gazeInteraction/usePageScope';
import { useGazeTarget } from '../../gazeInteraction/useGazeTarget';
import { useUserSettings } from '../../userSetting/hooks/useUserSettings';
import { mapInputMethodIdToBackend } from '../inputMethodMapping';
import { getInputSessions } from '../../calibration/api/inputSessionApi';
import { recommend } from '../utils/recommend';
import type { MeasurementRow } from '../utils/recommend';
import type { InputMethodId } from '../types/analysis';
import type { RecommendationDashboardData } from '../types/recommendation';
import type { InputSessionLogDto } from '../../../shared/types/backend';

import RecommendationResults from './RecommendationResults';
import InputMethodSelectionModal from './InputMethodSelectionModal';

import './AnalysisDashboard.css';

type ModalKind =
  | 'input-choice'
  | 'input-selection'
  | 'retest-intro'
  | 'change-success'
  | null;

/* =========================================================
   백엔드 측정 이력 데이터 변환
========================================================= */

function toMeasurementRows(rows: InputSessionLogDto[]): MeasurementRow[] {
  return rows.flatMap((row) => {
    if (
      !row.calibrationId ||
      row.typoRate === null ||
      row.inputSpeed === null
    ) {
      return [];
    }

    if (
      row.inputMethod !== 'EYE_TRACKING' &&
      row.inputMethod !== 'BLINK' &&
      row.inputMethod !== 'MOUTH'
    ) {
      return [];
    }

    return [
      {
        calibrationId: row.calibrationId,
        inputMethod: row.inputMethod,
        inputSpeed: row.inputSpeed,
        typoRate: row.typoRate,
        sessionAt: row.sessionAt,
      },
    ];
  });
}

export default function AnalysisDashboard() {
  const navigate = useNavigate();
  usePageScope('MAIN');
  const { setActiveScope } = useGazeInteraction();
  const [modalKind, setModalKind] = useState<ModalKind>(null);

  /* =========================================================
     추천 결과 및 백엔드 측정 이력 조회
  ========================================================= */

  const [recommendationData, setRecommendationData] =
    useState<RecommendationDashboardData>(() => recommend([]));

  useEffect(() => {
    let cancelled = false;

    const fetchRecommendation = async () => {
      try {
        const response = await getInputSessions('CALIBRATION_TEST', 30);

        const history = toMeasurementRows(response);

        const result = recommend(history);

        if (!cancelled) {
          setRecommendationData(result);
        }
      } catch (error) {
        console.error('입력 방식 측정 이력 조회 실패:', error);

        if (!cancelled) {
          setRecommendationData(recommend([]));
        }
      }
    };

    void fetchRecommendation();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================================================
     분석 항목 이동
  ========================================================= */

  // InputMethodSelectionModal의 선택이 실제 Backend UserSetting에 저장되도록 한다.
  const { updateSettings } = useUserSettings();
  const [isSavingInputMethod, setIsSavingInputMethod] = useState(false);
  const [inputMethodError, setInputMethodError] = useState<string | null>(null);

  const handleSelectInputMethod = async (inputMethodId: InputMethodId) => {
    if (isSavingInputMethod) return;

    setIsSavingInputMethod(true);
    setInputMethodError(null);

    try {
      await updateSettings({
        currentInputMethod: mapInputMethodIdToBackend(inputMethodId),
      });

      setModalKind('change-success');
    } catch (error) {
      console.error('입력 방식 저장 실패:', error);
      setInputMethodError(
        '입력 방식을 저장하지 못했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setIsSavingInputMethod(false);
    }
  };

  const closeModal = () => setModalKind(null);

  // 모달이 열려 있는 동안 MODAL scope로 전환한다.
  useEffect(() => {
    setActiveScope(modalKind === null ? 'MAIN' : 'MODAL');
  }, [modalKind, setActiveScope]);

  const settingsTargetRef = useGazeTarget({
    id: 'analysis-settings',
    scope: 'MAIN',
    onSelect: () => navigate('/mypage'),
  });

  const hospitalChatTargetRef = useGazeTarget({
    id: 'analysis-chat-hospital',
    scope: 'MAIN',
    onSelect: () => navigate('/chat/hospital'),
  });

  const friendChatTargetRef = useGazeTarget({
    id: 'analysis-chat-friend',
    scope: 'MAIN',
    onSelect: () => navigate('/chat/friend'),
  });

  const openRetest = () => setModalKind('retest-intro');
  const openInputChoice = () => setModalKind('input-choice');

  const retestCardTargetRef = useGazeTarget({
    id: 'analysis-retest-card',
    scope: 'MAIN',
    onSelect: openRetest,
  });

  const changeInputTargetRef = useGazeTarget({
    id: 'analysis-change-input',
    scope: 'MAIN',
    onSelect: openInputChoice,
  });

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
        {/* ===================================================
            Header
        =================================================== */}

        <header className="analysis-header">
          <Link
            className="analysis-header__brand"
            to={ROUTES.MAIN}
            aria-label="Look Talk 메인 페이지로 이동"
          >
            <img
              className="analysis-header__brand-image"
              src={Logo}
              alt="Look Talk 로고"
            />
          </Link>

          <div className="analysis-header__navigation">
            {/* 설정 */}

            <button
              ref={settingsTargetRef}
              aria-label="설정 페이지로 이동"
              className="analysis-icon-button analysis-icon-button--settings"
              onClick={() => navigate('/mypage')}
              type="button"
            >
              <img src={Setting} alt="" />
            </button>

            <button
              ref={hospitalChatTargetRef}
              className="analysis-header-button"
              onClick={() => navigate('/chat/hospital')}
              type="button"
            >
              병원 채팅으로 이동
            </button>

            <button
              ref={friendChatTargetRef}
              className="analysis-header-button"
              onClick={() => navigate('/chat/friend')}
              type="button"
            >
              친구 채팅으로 이동
            </button>
          </div>

          {/* =================================================
              공통 비상호출
              마이페이지 / 개인메모장과 동일
          ================================================= */}

          <EmergencyButton />
        </header>

        <RecommendationResults
          data={recommendationData}
          onRetest={openRetest}
          retestRef={retestCardTargetRef}
          onChangeInput={openInputChoice}
          changeInputRef={changeInputTargetRef}
        />
      </div>

      {/* =====================================================
          입력 방식 변경 확인
      ===================================================== */}

      <BaseModal
        actions={[
          {
            label: '변경하기',
            onClick: () => setModalKind('input-selection'),
            tone: 'positive',
            gazeTargetRef: inputChoiceChangeTargetRef,
          },
          {
            label: '취소',
            onClick: closeModal,
            tone: 'neutral',
            gazeTargetRef: inputChoiceCancelTargetRef,
          },
        ]}
        isOpen={modalKind === 'input-choice'}
        onClose={closeModal}
      >
        <p>
          입력 방식을 변경하시겠습니까?
          <br />
          사용하고 싶은 입력 방식을 선택해 적용할 수 있습니다.
        </p>
      </BaseModal>

      {/* =====================================================
          재검사 안내
      ===================================================== */}

      <BaseModal
        actions={[
          {
            label: '검사 시작',
            onClick: () => navigate('/calibration?mode=retest&source=analysis'),
            tone: 'positive',
            gazeTargetRef: retestStartTargetRef,
          },
          {
            label: '취소',
            onClick: closeModal,
            tone: 'neutral',
            gazeTargetRef: retestCancelTargetRef,
          },
        ]}
        isOpen={modalKind === 'retest-intro'}
        onClose={closeModal}
      >
        <p>
          사용자 맞춤 추천을 위해 입력 방식 재측정을 시작합니다.
          <br />
          <br />
          시선, 눈 깜빡임, 입 움직임 검사가 순서대로 진행됩니다.
          <br />
          <br />
          Look Talk은 사용자의 얼굴 데이터를 저장하지 않습니다.
        </p>
      </BaseModal>

      {/* =====================================================
          입력 방식 변경 완료
      ===================================================== */}

      <BaseModal
        actions={[
          {
            label: '확인',
            onClick: closeModal,
            tone: 'neutral',
            gazeTargetRef: changeSuccessConfirmTargetRef,
          },
        ]}
        isOpen={modalKind === 'change-success'}
        onClose={closeModal}
      >
        <p>입력 방식이 변경되었습니다.</p>

        <p className="analysis-modal-supporting-text">
          자세한 분석 결과는 분석페이지를 참고하세요!
        </p>
      </BaseModal>

      {/* =====================================================
          입력 방식 선택
      ===================================================== */}

      <InputMethodSelectionModal
        isOpen={modalKind === 'input-selection'}
        isSaving={isSavingInputMethod}
        errorMessage={inputMethodError}
        onRetest={() => {
          setInputMethodError(null);
          setModalKind('retest-intro');
        }}
        onSelect={(inputMethodId) =>
          void handleSelectInputMethod(inputMethodId)
        }
      />
    </main>
  );
}
