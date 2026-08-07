import { useState } from 'react';
import { Link } from 'react-router-dom';

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
import { useFriendList } from '../../features/friend/hooks/useFriendList';
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
  | 'deleted'; // Frame 159

export default function FriendListPage() {
  const { visibleFriends, page, totalPages, goPrev, goNext } = useFriendList();

  const addFriend = useFriendStore((state) => state.addFriend);
  const updateFriend = useFriendStore((state) => state.updateFriend);
  const removeFriend = useFriendStore((state) => state.removeFriend);

  const [modal, setModal] = useState<FriendModal>('none');
  const [selected, setSelected] = useState<Friend | null>(null);
  const [pendingName, setPendingName] = useState('');

  const closeModal = () => setModal('none');

  const openActions = (friend: Friend) => {
    setSelected(friend);
    setModal('actions');
  };

  return (
    <div className="friend-page">
      <PageHeader
        title="친구 목록 관리"
        logoTo={ROUTES.MAIN}
        titleActions={
          <>
            <Link to={ROUTES.MYPAGE} className="header-pill-button">
              뒤로가기
            </Link>

            <button
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
        {visibleFriends.length === 0 ? (
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
          // TODO : 친구 등록 API 호출
          addFriend(values.name.trim(), values.phone.trim());
          setModal('created');
        }}
        onCancel={closeModal}
      />

      <AlertModal
        isOpen={modal === 'created'}
        message="새 친구가 등록되었습니다!"
        onConfirm={closeModal}
      />

      {/* ---------- 친구 카드 클릭 : Frame 171 ---------- */}
      <ActionModal
        isOpen={modal === 'actions'}
        message={selected?.name ?? ''}
        onClose={closeModal}
        actions={[
          { label: '수정하기', onClick: () => setModal('edit-input') },
          {
            label: '삭제하기',
            tone: 'danger',
            onClick: () => setModal('delete-confirm'),
          },
          { label: '취소', tone: 'muted', onClick: closeModal },
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
          // TODO : 친구 수정 API 호출
          if (selected) updateFriend(selected.id, pendingName);
          setModal('edited');
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
        confirmTone="danger"
        onConfirm={() => {
          // TODO : 친구 삭제 API 호출
          if (selected) removeFriend(selected.id);
          setModal('deleted');
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
