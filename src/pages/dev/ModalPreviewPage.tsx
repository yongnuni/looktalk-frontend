import { useState } from 'react';
import { BaseModal, type ModalAction } from '../../shared/components/modal';

type PreviewModal =
  | 'single'
  | 'confirm'
  | 'name'
  | 'phone'
  | 'privacy'
  | 'emergency-countdown'
  | 'emergency-complete'
  | null;

const privacyParagraphs = [
  'LookTalk은 원활한 서비스 제공을 위해 필요한 개인정보를 수집하고 이용합니다.',
  '수집하는 정보에는 이름, 전화번호, 서비스 이용 기록이 포함될 수 있습니다.',
  '수집된 정보는 회원 확인, 서비스 제공, 문의 대응 및 안전한 이용 환경을 위해 사용됩니다.',
  '개인정보는 수집 목적이 달성될 때까지 보관하며, 관련 법령에 따라 필요한 경우에는 해당 기간 동안 보관합니다.',
  '서비스 이용 과정에서 생성되는 이용 기록은 기능 개선과 오류 확인을 위해 활용될 수 있습니다.',
  '이용자는 개인정보 수집 및 이용에 대한 동의를 거부할 수 있습니다.',
  '다만 동의하지 않을 경우 전화번호 인증이 필요한 일부 기능을 이용하기 어려울 수 있습니다.',
  '개인정보 처리에 관한 자세한 내용은 개인정보 처리방침에서 확인할 수 있습니다.',
  '본 내용은 공통 팝업의 본문 스크롤 동작을 확인하기 위한 임시 설명입니다.',
  '스크롤 영역 안에서 내용을 확인한 뒤 원하는 액션을 선택할 수 있습니다.',
];

export default function ModalPreviewPage() {
  const [activeModal, setActiveModal] = useState<PreviewModal>(null);

  const closeModal = () => setActiveModal(null);
  const openModal = (modal: Exclude<PreviewModal, null>) => setActiveModal(modal);

  const getActions = (actions: ModalAction[]): ModalAction[] =>
    actions.map((action) => ({ ...action, onClick: closeModal }));

  const renderModal = () => {
    switch (activeModal) {
      case 'single':
        return (
          <BaseModal
            isOpen
            onClose={closeModal}
            actions={getActions([{ label: '확인', tone: 'neutral', onClick: closeModal }])}
          >
            대상을 찾을 수 없습니다.
          </BaseModal>
        );
      case 'confirm':
        return (
          <BaseModal
            isOpen
            onClose={closeModal}
            actions={getActions([
              { label: '등록', tone: 'positive', onClick: closeModal },
              { label: '취소', tone: 'neutral', onClick: closeModal },
            ])}
          >
            해당 문장을 자주 쓰는 문장으로 등록하시겠습니까?
          </BaseModal>
        );
      case 'name':
        return (
          <BaseModal
            isOpen
            title="엄마"
            onClose={closeModal}
            actions={getActions([
              { label: '수정하기', tone: 'positive', onClick: closeModal },
              { label: '삭제하기', tone: 'negative', onClick: closeModal },
              { label: '취소', tone: 'neutral', onClick: closeModal },
            ])}
          >
            저장된 이름을 관리합니다.
          </BaseModal>
        );
      case 'phone':
        return (
          <BaseModal
            isOpen
            onClose={closeModal}
            actions={getActions([
              { label: '인증하기', tone: 'positive', onClick: closeModal },
              { label: '취소', tone: 'neutral', onClick: closeModal },
            ])}
          >
            해당 페이지는 전화번호 인증 후에 사용할 수 있습니다.
            <br />
            인증하시겠습니까?
          </BaseModal>
        );
      case 'privacy':
        return (
          <BaseModal
            isOpen
            title="개인정보 수집 및 이용 동의"
            onClose={closeModal}
            actions={getActions([
              { label: '동의함', tone: 'positive', onClick: closeModal },
              { label: '동의하지 않음', tone: 'negative', onClick: closeModal },
            ])}
          >
            {privacyParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </BaseModal>
        );
      case 'emergency-countdown':
        return (
          <BaseModal
            isOpen
            onClose={closeModal}
            actions={getActions([{ label: '취소', tone: 'neutral', onClick: closeModal }])}
          >
            <p>응답이 없을 경우 5초 후 비상호출이 전송됩니다.</p>
            <strong className="base-modal-countdown" aria-label="5초">
              5
            </strong>
          </BaseModal>
        );
      case 'emergency-complete':
        return (
          <BaseModal
            isOpen
            variant="emergency"
            onClose={closeModal}
            actions={getActions([{ label: '확인', tone: 'neutral', onClick: closeModal }])}
          >
            달려오고 있어요! 조금만 기다려주세요!
          </BaseModal>
        );
      default:
        return null;
    }
  };

  return (
    <main className="page">
      <section className="card wide">
        <h1>공통 팝업 미리보기</h1>
        <p>아래 버튼을 눌러 아이트래킹용 공통 팝업의 상태를 확인할 수 있습니다.</p>

        <div className="button-group">
          <button type="button" onClick={() => openModal('single')}>
            버튼 1개 안내 팝업
          </button>
          <button type="button" onClick={() => openModal('confirm')}>
            버튼 2개 확인 팝업
          </button>
          <button type="button" onClick={() => openModal('name')}>
            버튼 3개 이름 관리 팝업
          </button>
          <button type="button" onClick={() => openModal('phone')}>
            전화번호 인증 팝업
          </button>
          <button type="button" onClick={() => openModal('privacy')}>
            긴 개인정보 동의 팝업
          </button>
          <button type="button" onClick={() => openModal('emergency-countdown')}>
            긴급호출 카운트다운 팝업
          </button>
          <button type="button" onClick={() => openModal('emergency-complete')}>
            긴급호출 완료 팝업
          </button>
        </div>
      </section>

      {renderModal()}
    </main>
  );
}
