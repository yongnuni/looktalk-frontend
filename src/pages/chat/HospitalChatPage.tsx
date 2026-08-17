import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getHospitalChatRooms } from '../../features/chat/api/chatRooms';
import PatientChatView from '../../features/chat/components/PatientChatView';
import type { ChatRoom } from '../../features/chat/types/chat';
import { mapHospitalChatRoomDtoToChatRoom } from '../../features/chat/utils/chatMappers';

// Front Step 17 §0/§4 BUG A/B root cause — 이전에는 여기서 hospitalChatMock.ts의 '요청'
// 목업 room을 실제 rooms 앞에 항상 붙였다. 그 room은 chatRoomId가 없는 순수 UI fixture라
// (Backend room_type은 HOSPITAL/SMS만 존재, 'REQUEST' 개념 자체가 없다) roomId 쿼리
// 파라미터 없이 이 페이지에 들어오면(=Main/MyPage/Analysis의 일반 "병원 채팅으로 이동"
// 전부) 매번 이 목업 room이 기본 선택되어 "메시지 보내기"가 신규/기존 계정 모두에서
// 영구적으로 disabled로 보였다. 실제 room만 다루도록 완전히 제거한다.
export default function HospitalChatPage() {
  const [searchParams] = useSearchParams();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  // §30 — room 목록 조회 실패를 조용히 빈 배열로만 치환하지 않고 화면에 알린다.
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialRoomId = searchParams.get('roomId') ?? '';

  useEffect(() => {
    let isMounted = true;

    const loadHospitalChatRooms = async () => {
      try {
        const hospitalRooms = await getHospitalChatRooms();

        if (isMounted) {
          setRooms(hospitalRooms.map(mapHospitalChatRoomDtoToChatRoom));
          setLoadError(null);
        }
      } catch {
        if (isMounted) {
          setRooms([]);
          setLoadError('채팅 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
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
      loadError={loadError}
      mode="hospital"
      rooms={rooms}
      searchPath="/patient?source=hospital-search"
      switchLabel="친구 채팅으로 이동"
      switchPath="/chat/friend"
      title="병원 채팅"
    />
  );
}
