import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../../../assets/Logo.png';
import Setting from '../../../assets/setting.png';
import Sos from '../../../assets/sos.png';
import BaseModal from '../../../shared/components/modal/BaseModal';
import { ROUTES } from '../../../shared/constants/routes';
import { analysisItems, initialAnalysis } from '../mock/analysisMock';
import type { AnalysisItem, InputMethodId } from '../types/analysis';
import MetricDonut from './MetricDonut';
import InputMethodSelectionModal from './InputMethodSelectionModal';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  KeyboardIcon,
  RecommendationIcon,
} from './AnalysisIcons';
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
  const [searchParams] = useSearchParams();
  const requestedInputId = searchParams.get('input') as InputMethodId | null;
  const requestedAnalysisIndex = analysisItems.findIndex((item) => item.id === requestedInputId);
  const initialIndex = requestedAnalysisIndex >= 0 ? requestedAnalysisIndex : 0;
  const [analysisIndex, setAnalysisIndex] = useState(initialIndex);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisItem>(analysisItems[initialIndex] ?? initialAnalysis);
  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [countdown, setCountdown] = useState(5);

  const moveAnalysis = (direction: -1 | 1) => {
    const nextIndex = (analysisIndex + direction + analysisItems.length) % analysisItems.length;
    setAnalysisIndex(nextIndex);
    setActiveAnalysis(analysisItems[nextIndex]);
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

  return (
    <main className="analysis-page">
      <div className="analysis-shell">
        <header className="analysis-header">
          <Link className="analysis-header__brand" to={ROUTES.MAIN} aria-label="Look Talk 메인 페이지로 이동">
            <img className="analysis-header__brand-image" src={Logo} alt="Look Talk 로고" />
          </Link>

          <div className="analysis-header__navigation">
            <button
              aria-label="설정 페이지로 이동"
              className="analysis-icon-button analysis-icon-button--settings"
              onClick={() => navigate('/mypage')}
              type="button"
            >
              <img src={Setting} alt="" />
            </button>
            <button className="analysis-header-button" onClick={() => navigate('/chat/hospital')} type="button">
              병원 채팅으로 이동
            </button>
            <button className="analysis-header-button" onClick={() => navigate('/chat/friend')} type="button">
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
            <RecommendationIcon />
            <span>추천 입력 방식: “{activeAnalysis.recommendedMethod}”</span>
          </h1>
          <p className="analysis-intro__current">“{activeAnalysis.inputMethod}”</p>
        </section>

        <section className="analysis-metrics" aria-label={`${activeAnalysis.inputMethod} 분석 지표`}>
          {activeAnalysis.metrics.map((metric) => (
            <MetricDonut key={metric.id} metric={metric} />
          ))}
        </section>

        <nav className="analysis-controls" aria-label="분석 항목 이동">
          <button
            aria-label="이전 입력 방식 분석 보기"
            className="analysis-control-button analysis-control-button--arrow"
            onClick={() => moveAnalysis(-1)}
            type="button"
          >
            <ArrowLeftIcon />
          </button>
          <button
            aria-label="입력 방식 변경 또는 재검사"
            className="analysis-control-button analysis-control-button--keyboard"
            onClick={() => setModalKind('input-choice')}
            type="button"
          >
            <KeyboardIcon />
            <span>입력 방식 변경</span>
          </button>
          <button
            aria-label="다음 입력 방식 분석 보기"
            className="analysis-control-button analysis-control-button--arrow"
            onClick={() => moveAnalysis(1)}
            type="button"
          >
            <ArrowRightIcon />
          </button>
        </nav>
      </div>

      <BaseModal
        actions={[
          { label: '변경하기', onClick: () => setModalKind('input-selection'), tone: 'positive' },
          { label: '취소', onClick: closeModal, tone: 'neutral' },
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
          },
          { label: '취소', onClick: closeModal, tone: 'neutral' },
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
        actions={[{ label: '확인', onClick: closeModal, tone: 'neutral' }]}
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
        onRetest={() => setModalKind('retest-intro')}
        onSelect={(inputMethodId) => {
          const nextIndex = analysisItems.findIndex((item) => item.id === inputMethodId);
          if (nextIndex < 0) return;

          setAnalysisIndex(nextIndex);
          setActiveAnalysis(analysisItems[nextIndex]);
          setModalKind('change-success');
        }}
      />
    </main>
  );
}
