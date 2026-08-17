import { useSearchParams } from 'react-router-dom';
import PatientChatView from '../../features/chat/components/PatientChatView';
import { mockCurrentPatientUser } from '../../features/chat/mock/friendChatMock';
import type { ChatRoom } from '../../features/chat/types/chat';
import { ROUTES } from '../../shared/constants/routes';
import { useFriendChatRooms } from '../../features/friend/hooks/useFriendChatRooms';

// Front Step 17 §0/§9 — 이전에는 initialRoomId가 'friendship-1'로 하드코딩되어 있었다.
// 계정마다 실제 friendshipId가 다르므로(신규 계정은 1이 아닐 수 있고 애초에 없을 수도
// 있다) 특정 계정에만 우연히 맞는 값이었다. PatientChatView의 `?? rooms[0]` fallback이
// 있어 message-send 자체가 막히지는 않았지만, 의미 없는 하드코딩이라 제거한다.
//
// searchPath도 '/patient?source=friend-search'라는 dead path였다(PatientHomePage는
// 'hospital-search'만 처리한다) — Friend는 Backend에 "키워드로 지인 검색" 개념 자체가
// 없고(FRIEND는 등록된 지인을 room-grid에서 바로 선택하는 구조), 실제로 지인을 추가/관리
// 하는 이미 존재하는 화면인 MYPAGE_FRIENDS로 대체한다(새 기능을 만들지 않는다, §5).
export default function FriendChatPage() {
  const [searchParams] = useSearchParams();
  const { rooms: friendChatRooms, ensureSmsChatRoom, error: friendChatError } = useFriendChatRooms();
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
      initialRoomId=""
      loadError={phoneVerified ? friendChatError : null}
      mode="friend"
      onRoomSelect={handleFriendSelect}
      phoneVerified={phoneVerified}
      rooms={phoneVerified ? friendChatRooms : []}
      searchPath={ROUTES.MYPAGE_FRIENDS}
      switchLabel="병원 채팅으로 이동"
      switchPath="/chat/hospital"
      title="친구 채팅"
    />
  );
}
