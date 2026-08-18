import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

import PageHeader from '../../shared/components/layout/PageHeader';
import MenuCard from '../../shared/components/card/MenuCard';
import ArrowPagination from '../../shared/components/pagination/ArrowPagination';
import {
  ActionModal,
  AlertModal,
  ConfirmModal,
  InputModal,
} from '../../shared/components/modal';
import EmergencyButton from '../../features/emergency/components/EmergencyButton';
import { usePageScope } from '../../features/gazeInteraction/usePageScope';
import { useGazeTarget } from '../../features/gazeInteraction/useGazeTarget';
import { useFriendList } from '../../features/friend/hooks/useFriendList';
import {
  createSmsFriend,
  deleteSmsFriend,
  updateSmsFriend,
} from '../../features/friend/api/friends';
import { useFriendStore } from '../../shared/stores/friendStore';
import { ROUTES } from '../../shared/constants/routes';
import type { Friend } from '../../shared/types/mypage';

import './FriendListPage.css';

type FriendModal =
  | 'none'
  | 'create' // Frame 130
  | 'created' // Frame 156
  | 'actions' // Frame 171
  | 'edit-input' // 이름 입력 (Frame 130 형식 재사용)
  | 'edit-confirm' // Frame 170
  | 'edited' // Frame 169
  | 'delete-confirm' // Frame 158
  | 'deleted' // Frame 159
  | 'error';

function getFriendErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (typeof message === 'string' && message) return message;
  }

  return fallback;
}

export default function FriendListPage() {
  const navigate = useNavigate();
  usePageScope('MAIN');

  const { visibleFriends, page, totalPages, isLoading, hasError, goPrev, goNext } =
    useFriendList();

  const addFriend = useFriendStore((state) => state.addFriend);
  const updateFriend = useFriendStore((state) => state.updateFriend);
  const removeFriend = useFriendStore((state) => state.removeFriend);

  const [modal, setModal] = useState<FriendModal>('none');
  const [selected, setSelected] = useState<Friend | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const closeModal = () => setModal('none');

  const openActions = (friend: Friend) => {
    setSelected(friend);
    setModal('actions');
  };

  // §31 — 실제 존재하는 핵심 navigation/action(뒤로가기, 새 친구 등록, 페이지 이동)만.
  // 개별 친구 카드는 페이지당 최대 8개까지 가변적이라(§28/§10과 동일한 hooks 규칙 제약)
  // 이번 범위에서는 제외한다 — Priority 4(list item)라 우선순위도 가장 낮다(§52).
  const backTargetRef = useGazeTarget({ id: 'friend-list-back', scope: 'MAIN', onSelect: () => navigate(ROUTES.MYPAGE) });
  const createTargetRef = useGazeTarget({ id: 'friend-list-create', scope: 'MAIN', onSelect: () => setModal('create') });
  const prevPageTargetRef = useGazeTarget({ id: 'friend-list-page-prev', scope: 'MAIN', enabled: page > 1, onSelect: goPrev });
  const nextPageTargetRef = useGazeTarget({
    id: 'friend-list-page-next',
    scope: 'MAIN',
    enabled: page < totalPages,
    onSelect: goNext,
  });

  return (
    <div className="friend-page">
      <PageHeader
        title="친구 목록 관리"
        logoTo={ROUTES.MAIN}
        titleActions={
          <>
            <Link ref={backTargetRef} to={ROUTES.MYPAGE} className="header-pill-button">
              뒤로가기
            </Link>

            <button
              ref={createTargetRef}
              type="button"
              className="header-pill-button accent"
              onClick={() => setModal('create')}
            >
              새 친구
              <br />
              등록하기
            </button>
          </>
        }
        right={<EmergencyButton />}
      />

      <main className="friend-content">
        {isLoading ? (
          <p className="friend-empty">친구 목록을 불러오는 중입니다.</p>
        ) : hasError ? (
          <p className="friend-empty" role="alert">
            친구 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        ) : visibleFriends.length === 0 ? (
          <p className="friend-empty">
            아직 등록된 친구가 없습니다. 새 친구를 등록해 보세요.
          </p>
        ) : (
          <div className="friend-grid">
            {visibleFriends.map((friend) => (
              <MenuCard
                key={friend.id}
                label={friend.name}
                onClick={() => openActions(friend)}
              />
            ))}
          </div>
        )}
      </main>

      <ArrowPagination
        page={page}
        totalPages={totalPages}
        onPrev={goPrev}
        onNext={goNext}
        prevGazeTargetRef={prevPageTargetRef}
        nextGazeTargetRef={nextPageTargetRef}
      />

      {/* ---------- 새 친구 등록 : Frame 130 → 156 ---------- */}
      <InputModal
        isOpen={modal === 'create'}
        message="새 친구의 전화번호를 입력하세요."
        confirmLabel="등록하기"
        fields={[
          { name: 'phone', placeholder: '010-1234-5678', type: 'tel' },
          { name: 'name', placeholder: '이름을 입력하세요.' },
        ]}
        onConfirm={(values) => {
          void (async () => {
            try {
              const created = await createSmsFriend({
                name: values.name.trim(),
                phone: values.phone.trim(),
              });

              addFriend({
                id: created.friendshipId,
                name: created.name,
                phone: created.phone,
              });

              setModal('created');
            } catch (error) {
              setErrorMessage(
                getFriendErrorMessage(error, '친구 등록에 실패했습니다.'),
              );
              setModal('error');
            }
          })();
        }}
        onCancel={closeModal}
      />

      <AlertModal
        isOpen={modal === 'created'}
        message="새 친구가 등록되었습니다!"
        onConfirm={closeModal}
      />

      <AlertModal
        isOpen={modal === 'error'}
        message={errorMessage}
        onConfirm={closeModal}
      />

      {/* ---------- 친구 카드 클릭 : Frame 171 ---------- */}
      <ActionModal
        isOpen={modal === 'actions'}
        message={selected?.name ?? ''}
        onClose={closeModal}
        actions={[
          {
            label: '수정하기',
            tone: 'positive',
            onClick: () => setModal('edit-input'),
          },
          {
            label: '삭제하기',
            tone: 'negative',
            onClick: () => setModal('delete-confirm'),
          },
          { label: '취소', tone: 'neutral', onClick: closeModal },
        ]}
      />

      {/* ---------- 친구 수정 : 이름 입력 → Frame 170 → 169 ---------- */}
      <InputModal
        isOpen={modal === 'edit-input'}
        message="수정할 이름을 입력하세요."
        confirmLabel="수정하기"
        fields={[
          {
            name: 'name',
            placeholder: selected?.name ?? '이름을 입력하세요.',
            initialValue: selected?.name ?? '',
          },
        ]}
        onConfirm={(values) => {
          setPendingName(values.name.trim());
          setModal('edit-confirm');
        }}
        onCancel={closeModal}
      />

      <ConfirmModal
        isOpen={modal === 'edit-confirm'}
        message="해당 친구를 수정하시겠습니까?"
        confirmLabel="수정하기"
        onConfirm={() => {
          void (async () => {
            if (!selected) return;

            try {
              const updated = await updateSmsFriend(selected.id, {
                name: pendingName,
              });

              updateFriend(selected.id, {
                name: updated.name,
                phone: updated.phone,
              });

              setModal('edited');
            } catch (error) {
              setErrorMessage(
                getFriendErrorMessage(error, '친구 수정에 실패했습니다.'),
              );
              setModal('error');
            }
          })();
        }}
        onCancel={closeModal}
      />

      <AlertModal
        isOpen={modal === 'edited'}
        message="해당 친구가 수정되었습니다."
        onConfirm={closeModal}
      />

      {/* ---------- 친구 삭제 : Frame 158 → 159 ---------- */}
      <ConfirmModal
        isOpen={modal === 'delete-confirm'}
        message="해당 친구를 삭제하시겠습니까?"
        confirmLabel="삭제하기"
        confirmTone="negative"
        onConfirm={() => {
          void (async () => {
            if (!selected) return;

            try {
              await deleteSmsFriend(selected.id);
              removeFriend(selected.id);
              setModal('deleted');
            } catch (error) {
              setErrorMessage(
                getFriendErrorMessage(error, '친구 삭제에 실패했습니다.'),
              );
              setModal('error');
            }
          })();
        }}
        onCancel={closeModal}
      />

      <AlertModal
        isOpen={modal === 'deleted'}
        message="해당 친구가 삭제되었습니다."
        onConfirm={closeModal}
      />
    </div>
  );
}
