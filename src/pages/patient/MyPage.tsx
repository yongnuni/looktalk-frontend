import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../../shared/components/layout/PageHeader';
import MenuCard from '../../shared/components/card/MenuCard';
import {
  AlertModal,
  ConfirmModal,
  InputModal,
} from '../../shared/components/modal';
import EmergencyButton from '../../features/emergency/components/EmergencyButton';
import { usePageScope } from '../../features/gazeInteraction/usePageScope';
import { useGazeTarget } from '../../features/gazeInteraction/useGazeTarget';
import { useAccountModals } from '../../features/mypage/hooks/useAccountModals';
import { usePatientProfileStore } from '../../shared/stores/patientProfileStore';
import { ROUTES } from '../../shared/constants/routes';

import './MyPage.css';

type NicknameModal = 'none' | 'edit' | 'done';

export default function MyPage() {
  const navigate = useNavigate();
  usePageScope('MAIN');

  const hospitalNickname = usePatientProfileStore(
    (state) => state.hospitalNickname,
  );
  const setHospitalNickname = usePatientProfileStore(
    (state) => state.setHospitalNickname,
  );
  const isPhoneVerified = usePatientProfileStore(
    (state) => state.isPhoneVerified,
  );

  const [nicknameModal, setNicknameModal] = useState<NicknameModal>('none');
  const [showPhoneRequired, setShowPhoneRequired] = useState(false);

  const account = useAccountModals({ redirectTo: ROUTES.LOGIN });

  const handleFriendListClick = () => {
    if (!isPhoneVerified) {
      setShowPhoneRequired(true);
      return;
    }

    navigate(ROUTES.MYPAGE_FRIENDS);
  };

  // §31 — 실제 존재하는 9개 메뉴 카드를 gaze target으로 만든다. Mouse handler(Link의 to,
  // onClick)를 그대로 재사용한다(§24/§43).
  const hospitalChatTargetRef = useGazeTarget({ id: 'mypage-chat-hospital', scope: 'MAIN', onSelect: () => navigate(ROUTES.CHAT_HOSPITAL) });
  const friendChatTargetRef = useGazeTarget({ id: 'mypage-chat-friend', scope: 'MAIN', onSelect: () => navigate(ROUTES.CHAT_FRIEND) });
  const analysisTargetRef = useGazeTarget({ id: 'mypage-analysis', scope: 'MAIN', onSelect: () => navigate(ROUTES.ANALYSIS) });
  const nicknameTargetRef = useGazeTarget({ id: 'mypage-nickname', scope: 'MAIN', onSelect: () => setNicknameModal('edit') });
  const passwordResetTargetRef = useGazeTarget({ id: 'mypage-password-reset', scope: 'MAIN', onSelect: () => navigate(ROUTES.PASSWORD_RESET) });
  const phoneVerifyTargetRef = useGazeTarget({ id: 'mypage-phone-verify', scope: 'MAIN', onSelect: () => navigate(ROUTES.MYPAGE_PHONE_VERIFY) });
  const friendListTargetRef = useGazeTarget({ id: 'mypage-friend-list', scope: 'MAIN', onSelect: handleFriendListClick });
  const phrasesTargetRef = useGazeTarget({ id: 'mypage-phrases', scope: 'MAIN', onSelect: () => navigate(ROUTES.MYPAGE_PHRASES) });
  const logoutTargetRef = useGazeTarget({ id: 'mypage-logout', scope: 'MAIN', onSelect: account.openLogout });
  const withdrawTargetRef = useGazeTarget({ id: 'mypage-withdraw', scope: 'MAIN', onSelect: account.openWithdraw });

  return (
    <div className="mypage">
      <PageHeader
        title="마이페이지"
        logoTo={ROUTES.MAIN}
        right={<EmergencyButton />}
      />

      <main className="mypage-content">
        {/* 상단 줄 : 다른 페이지로 이동 */}
        <section className="mypage-row mypage-row-wide">
          <MenuCard
            ref={hospitalChatTargetRef}
            variant="wide"
            label="병원 채팅으로 이동"
            to={ROUTES.CHAT_HOSPITAL}
          />
          <MenuCard
            ref={friendChatTargetRef}
            variant="wide"
            label="친구 채팅으로 이동"
            to={ROUTES.CHAT_FRIEND}
          />
          <MenuCard
            ref={analysisTargetRef}
            variant="wide"
            label="분석페이지로 이동"
            to={ROUTES.ANALYSIS}
          />
        </section>

        {/* 중간 줄 : 설정 */}
        <section className="mypage-row">
          <MenuCard
            ref={nicknameTargetRef}
            label={
              <>
                병원 내
                <br />
                이름 설정
              </>
            }
            onClick={() => setNicknameModal('edit')}
          />

          <MenuCard
            ref={passwordResetTargetRef}
            label={
              <>
                비밀번호
                <br />
                재설정
              </>
            }
            to={ROUTES.PASSWORD_RESET}
          />

          <MenuCard
            ref={phoneVerifyTargetRef}
            label={
              <>
                전화번호 인증
                <br />
                (메시지 연동)
              </>
            }
            to={ROUTES.MYPAGE_PHONE_VERIFY}
          />

          <MenuCard
            ref={friendListTargetRef}
            label="친구 목록 관리"
            locked={!isPhoneVerified}
            onClick={handleFriendListClick}
          />
        </section>

        {/* 하단 줄 : 문장 관리 / 계정 */}
        <section className="mypage-row">
          <MenuCard
            ref={phrasesTargetRef}
            label={
              <>
                자주 쓰는
                <br />
                문장 관리
              </>
            }
            to={ROUTES.MYPAGE_PHRASES}
          />

          <MenuCard ref={logoutTargetRef} label="로그아웃" onClick={account.openLogout} />
          <MenuCard ref={withdrawTargetRef} label="회원탈퇴" onClick={account.openWithdraw} />
        </section>
      </main>

      {/* ---------- 병원 내 이름 설정 : Frame 167 → 166 ---------- */}
      <InputModal
        isOpen={nicknameModal === 'edit'}
        message="병원채팅에서 사용할 이름을 입력하세요."
        confirmLabel="설정하기"
        fields={[
          {
            name: 'nickname',
            placeholder: hospitalNickname,
            initialValue: hospitalNickname,
          },
        ]}
        onConfirm={(values) => {
          // TODO : 병원 내 이름 변경 API 호출
          setHospitalNickname(values.nickname.trim());
          setNicknameModal('done');
        }}
        onCancel={() => setNicknameModal('none')}
      />

      <AlertModal
        isOpen={nicknameModal === 'done'}
        message="이름이 변경되었습니다."
        onConfirm={() => setNicknameModal('none')}
      />

      {/* ---------- 전화번호 미인증 안내 : Frame 160 ---------- */}
      <AlertModal
        isOpen={showPhoneRequired}
        message="전화번호가 인증되어 있지 않습니다. 전화번호 인증을 해주세요!"
        onConfirm={() => setShowPhoneRequired(false)}
      />

      {/* ---------- 로그아웃 : Frame 183 → 184 ---------- */}
      <ConfirmModal
        isOpen={account.modal === 'logout-confirm'}
        message="로그아웃을 하시겠습니까?"
        confirmLabel="로그아웃"
        onConfirm={account.confirmLogout}
        onCancel={account.close}
      />

      <AlertModal
        isOpen={account.modal === 'logout-done'}
        message="로그아웃 되었습니다."
        onConfirm={account.finish}
      />

      {/* ---------- 회원탈퇴 : Frame 185 → 186 ---------- */}
      <ConfirmModal
        isOpen={account.modal === 'withdraw-confirm'}
        message="회원탈퇴를 하시겠습니까? 회원탈퇴 시 모든 개인정보 및 이용 기록이 삭제되며 복구할 수 없습니다."
        confirmLabel="회원탈퇴"
        confirmTone="negative"
        onConfirm={account.confirmWithdraw}
        onCancel={account.close}
      />

      <AlertModal
        isOpen={account.modal === 'withdraw-done'}
        message="회원탈퇴 되었습니다."
        onConfirm={account.finish}
      />
    </div>
  );
}
