import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getHospitalChatRooms } from '../../features/chat/api/chatRooms';
import PatientChatView from '../../features/chat/components/PatientChatView';
import { hospitalChatRooms } from '../../features/chat/mock/hospitalChatMock';
import type { ChatRoom } from '../../features/chat/types/chat';
import { mapHospitalChatRoomDtoToChatRoom } from '../../features/chat/utils/chatMappers';

const requestChatRoom =
  hospitalChatRooms.find((room) => room.id === 'request' && room.icon === 'request') ??
  hospitalChatRooms[0];

export default function HospitalChatPage() {
  const [searchParams] = useSearchParams();
  const [rooms, setRooms] = useState<ChatRoom[]>([requestChatRoom]);
  const initialRoomId = searchParams.get('roomId') ?? 'request';

  useEffect(() => {
    let isMounted = true;

    const loadHospitalChatRooms = async () => {
      try {
        const hospitalRooms = await getHospitalChatRooms();

        if (isMounted) {
          setRooms([requestChatRoom, ...hospitalRooms.map(mapHospitalChatRoomDtoToChatRoom)]);
        }
      } catch {
        if (isMounted) {
          setRooms([requestChatRoom]);
        }
      }
    };

    void loadHospitalChatRooms();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <PatientChatView
      initialRoomId={initialRoomId}
      messagePath="/patient?source=hospital-message"
      mode="hospital"
      rooms={rooms}
      searchPath="/patient?source=hospital-search"
      switchLabel="친구 채팅으로 이동"
      switchPath="/chat/friend"
      title="병원 채팅"
    />
  );
}
