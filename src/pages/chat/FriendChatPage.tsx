import { useSearchParams } from 'react-router-dom';
import PatientChatView from '../../features/chat/components/PatientChatView';
import { mockCurrentPatientUser } from '../../features/chat/mock/friendChatMock';
import type { ChatRoom } from '../../features/chat/types/chat';
import { useFriendChatRooms } from '../../features/friend/hooks/useFriendChatRooms';

export default function FriendChatPage() {
  const [searchParams] = useSearchParams();
  const { rooms: friendChatRooms, ensureSmsChatRoom } = useFriendChatRooms();
  const phoneVerified =
    searchParams.get('verified') === 'false'
      ? false
      : mockCurrentPatientUser.is_sms_verified === true;

  const handleFriendSelect = (room: ChatRoom) => {
    if (room.friendshipId === undefined) return;

    void ensureSmsChatRoom(room.friendshipId);
  };

  return (
    <PatientChatView
      initialRoomId="friendship-1"
      messagePath="/patient?source=friend-message"
      mode="friend"
      onRoomSelect={handleFriendSelect}
      phoneVerified={phoneVerified}
      rooms={phoneVerified ? friendChatRooms : []}
      searchPath="/patient?source=friend-search"
      switchLabel="병원 채팅으로 이동"
      switchPath="/chat/hospital"
      title="친구 채팅"
    />
  );
}
