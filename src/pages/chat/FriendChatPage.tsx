import { useSearchParams } from 'react-router-dom';
import PatientChatView from '../../features/chat/components/PatientChatView';
import { friendChatRooms } from '../../features/chat/mock/friendChatMock';

export default function FriendChatPage() {
  const [searchParams] = useSearchParams();
  const phoneVerified = searchParams.get('verified') !== 'false';

  return (
    <PatientChatView
      initialRoomId="friend-mom"
      messagePath="/patient?source=friend-message"
      mode="friend"
      phoneVerified={phoneVerified}
      rooms={phoneVerified ? friendChatRooms : []}
      searchPath="/patient?source=friend-search"
      switchLabel="병원 채팅으로 이동"
      switchPath="/chat/hospital"
      title="친구 채팅"
    />
  );
}
