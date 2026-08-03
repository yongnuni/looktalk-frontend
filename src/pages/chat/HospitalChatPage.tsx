import PatientChatView from '../../features/chat/components/PatientChatView';
import { hospitalChatRooms } from '../../features/chat/mock/hospitalChatMock';

export default function HospitalChatPage() {
  return (
    <PatientChatView
      initialRoomId="request"
      messagePath="/patient?source=hospital-message"
      mode="hospital"
      rooms={hospitalChatRooms}
      searchPath="/patient?source=hospital-search"
      switchLabel="친구 채팅으로 이동"
      switchPath="/chat/friend"
      title="병원 채팅"
    />
  );
}
