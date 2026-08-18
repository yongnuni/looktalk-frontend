import { useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../../shared/components/layout/PageHeader';
import { AlertModal, ConfirmModal, InputModal } from '../../shared/components/modal';
import EmergencyButton from '../../features/emergency/components/EmergencyButton';
import { usePhrases } from '../../features/phrase/hooks/usePhrases';
import { ROUTES } from '../../shared/constants/routes';
import type { Phrase } from '../../shared/types/mypage';

import './PhrasePage.css';

type PhraseModal = 'none' | 'create' | 'created' | 'delete-confirm' | 'deleted';

export default function PhrasePage() {
  const {
    phrases,
    maxPhrases,
    isLoading,
    hasError,
    isSaving,
    registerPhrase,
    removePhrase,
  } = usePhrases();

  const [modal, setModal] = useState<PhraseModal>('none');
  const [selected, setSelected] = useState<Phrase | null>(null);
  const [registerError, setRegisterError] = useState(false);

  const closeModal = () => setModal('none');

  const openDelete = (phrase: Phrase) => {
    setSelected(phrase);
    setModal('delete-confirm');
  };

  return (
    <div className="phrase-page">
      <PageHeader
        title="자주 쓰는 문장 관리"
        logoTo={ROUTES.MAIN}
        titleActions={
          <Link to={ROUTES.MYPAGE} className="header-pill-button">
            뒤로가기
          </Link>
        }
        right={<EmergencyButton />}
      />

      <div className="phrase-toolbar">
        <button
          type="button"
          className="phrase-register-button"
          onClick={() => {
            setRegisterError(false);
            setModal('create');
          }}
        >
          문장 등록하기
        </button>

        <p className="phrase-guide">
          자주 쓰는 문장은 {maxPhrases}개까지 등록 가능합니다!
        </p>
      </div>

      <main className="phrase-list">
        {isLoading && <p className="phrase-status">문장을 불러오는 중입니다.</p>}

        {!isLoading && hasError && (
          <p className="phrase-status" role="alert">
            문장을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        )}

        {/* 등록된 문장이 없으면 공백으로 둔다 (Figma Default) */}
        {!isLoading &&
          !hasError &&
          phrases.map((phrase) => (
            <div className="phrase-item" key={phrase.id}>
              <span className="phrase-text">{phrase.text}</span>

              <button
                type="button"
                className="phrase-remove-button"
                onClick={() => openDelete(phrase)}
                aria-label={`${phrase.text} 삭제`}
              >
                삭제
              </button>
            </div>
          ))}
      </main>

      {/* ---------- 문장 등록 ---------- */}
      <InputModal
        isOpen={modal === 'create'}
        message="자주 쓰는 문장을 입력하세요."
        confirmLabel={isSaving ? '등록 중...' : '등록하기'}
        fields={[{ name: 'text', placeholder: '예) 물 주세요', maxLength: 100 }]}
        onConfirm={(values) => {
          void (async () => {
            try {
              await registerPhrase(values.text);
              setModal('created');
            } catch (error) {
              console.error('문장 등록 실패:', error);
              setRegisterError(true);
              setModal('created');
            }
          })();
        }}
        onCancel={closeModal}
      />

      <AlertModal
        isOpen={modal === 'created'}
        message={
          registerError
            ? '문장 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.'
            : '새 문장이 등록되었습니다! 3개를 초과하면 가장 오래된 문장이 자동으로 삭제됩니다.'
        }
        onConfirm={closeModal}
      />

      {/* ---------- 문장 삭제 ---------- */}
      <ConfirmModal
        isOpen={modal === 'delete-confirm'}
        message="해당 문장을 삭제하시겠습니까?"
        confirmLabel="삭제하기"
        confirmTone="negative"
        onConfirm={() => {
          void (async () => {
            if (!selected) return;

            try {
              await removePhrase(selected.id);
              setModal('deleted');
            } catch (error) {
              console.error('문장 삭제 실패:', error);
              closeModal();
              alert('문장 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            }
          })();
        }}
        onCancel={closeModal}
      />

      <AlertModal
        isOpen={modal === 'deleted'}
        message="해당 문장이 삭제되었습니다."
        onConfirm={closeModal}
      />
    </div>
  );
}
