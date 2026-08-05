import { useSearchParams } from 'react-router-dom';
import PatientChatView from '../../features/chat/components/PatientChatView';
import { friendChatRooms, mockCurrentPatientUser } from '../../features/chat/mock/friendChatMock';

export default function FriendChatPage() {
  const [searchParams] = useSearchParams();
  const phoneVerified =
    searchParams.get('verified') === 'false'
      ? false
      : mockCurrentPatientUser.is_sms_verified === true;

  return (
    <PatientChatView
      initialRoomId="friendship-1"
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
