import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentUser } from '../../shared/api/currentUser';
import PatientChatView from '../../features/chat/components/PatientChatView';
import type { ChatRoom } from '../../features/chat/types/chat';
import { useFriendChatRooms } from '../../features/friend/hooks/useFriendChatRooms';

type SmsVerificationStatus = 'loading' | 'verified' | 'unverified' | 'error';

export default function FriendChatPage() {
  const [searchParams] = useSearchParams();
  const { rooms: friendChatRooms, ensureSmsChatRoom } = useFriendChatRooms();
  const [smsVerificationStatus, setSmsVerificationStatus] =
    useState<SmsVerificationStatus>('loading');
  const [verificationRetryCount, setVerificationRetryCount] = useState(0);
  const friendshipId = searchParams.get('friendshipId');
  const initialRoomId = friendshipId ? `friendship-${friendshipId}` : 'friendship-1';

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
      messagePath="/patient?source=friend-message"
      mode="friend"
      onRoomSelect={handleFriendSelect}
      onRetryPhoneVerification={retrySmsVerification}
      phoneVerificationStatus={smsVerificationStatus}
      rooms={smsVerificationStatus === 'verified' ? friendChatRooms : []}
      searchPath="/patient?source=friend-search"
      switchLabel="병원 채팅으로 이동"
      switchPath="/chat/hospital"
      title="친구 채팅"
    />
  );
}
