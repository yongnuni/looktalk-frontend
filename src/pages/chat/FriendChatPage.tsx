import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentUser } from '../../shared/api/currentUser';
import PatientChatView from '../../features/chat/components/PatientChatView';
import type { ChatRoom } from '../../features/chat/types/chat';
import { useFriendChatRooms } from '../../features/friend/hooks/useFriendChatRooms';

// Front Step 17 §0/§9 — 이전에는 initialRoomId가 'friendship-1'로 하드코딩되어 있었다.
// 계정마다 실제 friendshipId가 다르므로(신규 계정은 1이 아닐 수 있고 애초에 없을 수도
// 있다) 특정 계정에만 우연히 맞는 값이었다. friendshipId 쿼리 파라미터가 있으면 그것을
// 쓰고, 없으면 하드코딩 fallback 대신 빈 문자열로 두어 PatientChatView의 `?? rooms[0]`
// fallback이 실제 목록에서 선택하게 한다.
//
// origin/develop이 검색 버튼/입력/필터를 의도적으로 제거했다(사이드바 전환 버튼만 전체
// 너비로 남김, PatientChatView.css .patient-chat-sidebar-actions 참고) — searchPath prop
// 자체를 다시 넘기지 않는다. 지인 추가/관리는 기존 MyPage 친구관리 화면에서 하며, Chat
// sidebar에 검색 버튼 형태로 재도입하지 않는다.
type SmsVerificationStatus = 'loading' | 'verified' | 'unverified' | 'error';

export default function FriendChatPage() {
  const [searchParams] = useSearchParams();
  const { rooms: friendChatRooms, ensureSmsChatRoom, error: friendChatError } = useFriendChatRooms();
  const [smsVerificationStatus, setSmsVerificationStatus] =
    useState<SmsVerificationStatus>('loading');
  const [verificationRetryCount, setVerificationRetryCount] = useState(0);
  const friendshipId = searchParams.get('friendshipId');
  const initialRoomId = friendshipId ? `friendship-${friendshipId}` : '';

  useEffect(() => {
    let active = true;

    void getCurrentUser()
      .then((user) => {
        if (active) {
          setSmsVerificationStatus(user.smsVerified ? 'verified' : 'unverified');
        }
      })
      .catch(() => {
        if (active) setSmsVerificationStatus('error');
      });

    return () => {
      active = false;
    };
  }, [verificationRetryCount]);

  const retrySmsVerification = () => {
    setSmsVerificationStatus('loading');
    setVerificationRetryCount((count) => count + 1);
  };

  const handleFriendSelect = useCallback(async (room: ChatRoom) => {
    if (room.friendshipId === undefined) return;

    await ensureSmsChatRoom(room.friendshipId);
  }, [ensureSmsChatRoom]);

  return (
    <PatientChatView
      initialRoomId={initialRoomId}
      loadError={smsVerificationStatus === 'verified' ? friendChatError : null}
      mode="friend"
      onRoomSelect={handleFriendSelect}
      onRetryPhoneVerification={retrySmsVerification}
      phoneVerificationStatus={smsVerificationStatus}
      rooms={smsVerificationStatus === 'verified' ? friendChatRooms : []}
      switchLabel="병원 채팅으로 이동하기"
      switchPath="/chat/hospital"
      title="친구 채팅"
    />
  );
}
