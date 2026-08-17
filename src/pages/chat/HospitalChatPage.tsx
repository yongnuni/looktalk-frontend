import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getChatContacts } from '../../features/chat/api/chatContacts';
import {
  createOrGetHospitalChatRoom,
  getHospitalChatRooms,
} from '../../features/chat/api/chatRooms';
import PatientChatView from '../../features/chat/components/PatientChatView';
import { hospitalChatRooms } from '../../features/chat/mock/hospitalChatMock';
import type { ChatRoom } from '../../features/chat/types/chat';
import { mapHospitalChatRoomDtoToChatRoom } from '../../features/chat/utils/chatMappers';
import type { ChatContactDto, HospitalChatRoomDto } from '../../shared/types/backend';

// The request card occupies one of the four slots in the sidebar grid.
const HOSPITAL_CONTACTS_PER_PAGE = 3;

// origin/develop 제품 요구사항 — "요청" 카드가 4칸 grid의 1번 슬롯을 고정 차지하고,
// 나머지 3칸을 실제 chat-contacts가 채운다(그래서 HOSPITAL_CONTACTS_PER_PAGE=3).
// Backend에는 REQUEST room_type이 없어 이 카드는 실제 채팅방이 될 수 없으므로,
// selectedRoom/message-target 후보에서는 명시적으로 제외한다(PatientChatView.tsx의
// selectedRoom 계산·handleRoomSelect 참고) — "가짜 room이라 UI 자체를 지운다"가 아니라
// "UI는 유지하되 채팅 대상 후보에서만 제외"가 올바른 수정이다.
const requestChatRoom =
  hospitalChatRooms.find((room) => room.id === 'request' && room.icon === 'request') ??
  hospitalChatRooms[0];

function mergeHospitalContactsWithRooms(
  contacts: ChatContactDto[],
  hospitalRooms: HospitalChatRoomDto[],
  createdRoomIds: ReadonlyMap<string, number>,
): ChatRoom[] {
  const existingRoomsByUserId = new Map<string, ChatRoom>();

  hospitalRooms.forEach((hospitalRoom) => {
    const targetUserId = hospitalRoom.target.userId;

    if (targetUserId && !existingRoomsByUserId.has(targetUserId)) {
      existingRoomsByUserId.set(
        targetUserId,
        mapHospitalChatRoomDtoToChatRoom(hospitalRoom),
      );
    }
  });

  const seenUserIds = new Set<string>();

  return contacts.flatMap((contact) => {
    if (seenUserIds.has(contact.userId)) return [];

    seenUserIds.add(contact.userId);
    const existingRoom = existingRoomsByUserId.get(contact.userId);
    const chatRoomId = createdRoomIds.get(contact.userId) ?? existingRoom?.chatRoomId;

    return [
      {
        id: chatRoomId ? String(chatRoomId) : `hospital-contact-${contact.userId}`,
        chatRoomId,
        targetUserId: contact.userId,
        name:
          contact.displayName ||
          contact.name ||
          existingRoom?.name ||
          contact.userId,
        icon: 'person',
        messages: [],
      },
    ];
  });
}

// Front Step 17 §0/§4 BUG A/B root cause — '요청' 목업 room이 rooms 배열의 다른 원소와
// 동일하게 selectedRoom/message-target 후보로 취급되던 것이 문제였지, 카드 자체가 UI
// 요구사항이라는 사실은 아니었다. PatientChatView.tsx가 request 아이콘 room을
// selectedRoom fallback/handleRoomSelect 대상에서 제외하므로, 여기서는 origin/develop과
// 동일하게 요청 카드를 항상 1번 슬롯에 포함한다.
export default function HospitalChatPage() {
  const [searchParams] = useSearchParams();
  const [contacts, setContacts] = useState<ChatContactDto[]>([]);
  const [hospitalRooms, setHospitalRooms] = useState<HospitalChatRoomDto[]>([]);
  const [hasLoadedHospitalRooms, setHasLoadedHospitalRooms] = useState(false);
  const [createdRoomIds, setCreatedRoomIds] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [contactPage, setContactPage] = useState(0);
  const [hasNextContactPage, setHasNextContactPage] = useState(false);
  const [isContactPageLoading, setIsContactPageLoading] = useState(false);
  // §30 — room/contact 목록 조회 실패를 조용히 빈 배열로만 치환하지 않고 화면에 알린다.
  const [loadError, setLoadError] = useState<string | null>(null);
  const roomCreationRequestsRef = useRef(new Map<string, Promise<number>>());
  const initialRoomId = searchParams.get('roomId') ?? 'request';
  const rooms = useMemo(() => {
    if (!hasLoadedHospitalRooms) return [requestChatRoom];

    const contactRooms = mergeHospitalContactsWithRooms(
      contacts,
      hospitalRooms,
      createdRoomIds,
    );
    const requestedHospitalRoom = hospitalRooms.find(
      (hospitalRoom) => String(hospitalRoom.roomId) === initialRoomId,
    );
    const requestedRoomIsVisible = requestedHospitalRoom?.target.userId
      ? contactRooms.some(
          (room) => room.targetUserId === requestedHospitalRoom.target.userId,
        )
      : contactRooms.some((room) => room.chatRoomId === requestedHospitalRoom?.roomId);

    return [
      requestChatRoom,
      ...contactRooms,
      ...(requestedHospitalRoom && !requestedRoomIsVisible
        ? [mapHospitalChatRoomDtoToChatRoom(requestedHospitalRoom)]
        : []),
    ];
  }, [contacts, createdRoomIds, hasLoadedHospitalRooms, hospitalRooms, initialRoomId]);

  useEffect(() => {
    let isMounted = true;

    const loadHospitalChatRooms = async () => {
      try {
        const hospitalRooms = await getHospitalChatRooms();

        if (isMounted) {
          setHospitalRooms(hospitalRooms);
          setLoadError(null);
        }
      } catch {
        if (isMounted) {
          setHospitalRooms([]);
          setLoadError('채팅 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
      } finally {
        if (isMounted) {
          setHasLoadedHospitalRooms(true);
        }
      }
    };

    void loadHospitalChatRooms();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadHospitalContacts = async () => {
      setIsContactPageLoading(true);

      try {
        const data = await getChatContacts({
          page: contactPage,
          size: HOSPITAL_CONTACTS_PER_PAGE,
        });

        if (isMounted) {
          setContacts(data.content);
          setHasNextContactPage(data.hasNext);
          setLoadError(null);
        }
      } catch {
        if (isMounted) {
          setContacts([]);
          setHasNextContactPage(false);
          setLoadError('채팅 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
      } finally {
        if (isMounted) {
          setIsContactPageLoading(false);
        }
      }
    };

    void loadHospitalContacts();

    return () => {
      isMounted = false;
    };
  }, [contactPage]);

  const handleHospitalRoomSelect = useCallback(async (room: ChatRoom) => {
    if (room.chatRoomId || !room.targetUserId) return;

    const targetUserId = room.targetUserId;
    let roomRequest = roomCreationRequestsRef.current.get(targetUserId);

    if (!roomRequest) {
      roomRequest = createOrGetHospitalChatRoom(targetUserId).then(({ roomId }) => roomId);
      roomCreationRequestsRef.current.set(targetUserId, roomRequest);
    }

    try {
      const roomId = await roomRequest;

      setCreatedRoomIds((current) => {
        const next = new Map(current);
        next.set(targetUserId, roomId);
        return next;
      });

      return {
        ...room,
        id: String(roomId),
        chatRoomId: roomId,
      };
    } finally {
      if (roomCreationRequestsRef.current.get(targetUserId) === roomRequest) {
        roomCreationRequestsRef.current.delete(targetUserId);
      }
    }
  }, []);

  return (
    <PatientChatView
      initialRoomId={initialRoomId}
      loadError={loadError}
      mode="hospital"
      onRoomSelect={handleHospitalRoomSelect}
      roomPagination={{
        page: contactPage,
        hasNext: hasNextContactPage,
        isLoading: isContactPageLoading || !hasLoadedHospitalRooms,
        onPageChange: setContactPage,
      }}
      rooms={rooms}
      switchLabel="친구 채팅으로 이동하기"
      switchPath="/chat/friend"
      title="병원 채팅"
    />
  );
}
