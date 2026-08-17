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
import type {
  ChatContactDto,
  HospitalChatRoomDto,
} from '../../shared/types/backend';

// "요청" 카드 1개 + 실제 채팅 대상 3개 = 한 페이지 4칸
const HOSPITAL_CONTACTS_PER_PAGE = 3;

// 요청 카드는 일단 기존 mock 그대로 유지한다.
// 실제 1:1 메시지 전송 대상과는 연결하지 않는다.
const requestChatRoom =
  hospitalChatRooms.find(
    (room) => room.id === 'request' && room.icon === 'request',
  ) ?? hospitalChatRooms[0];

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
    if (seenUserIds.has(contact.userId)) {
      return [];
    }

    seenUserIds.add(contact.userId);

    const existingRoom = existingRoomsByUserId.get(contact.userId);
    const chatRoomId =
      createdRoomIds.get(contact.userId) ?? existingRoom?.chatRoomId;

    return [
      {
        // 채팅방이 이미 있으면 실제 roomId,
        // 아직 없으면 상대 userId 기반 임시 UI id 사용
        id: chatRoomId
          ? String(chatRoomId)
          : `hospital-contact-${contact.userId}`,

        chatRoomId,

        // 이 값으로 상대방과 1:1 채팅방을 생성한다.
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

export default function HospitalChatPage() {
  const [searchParams] = useSearchParams();

  const [contacts, setContacts] = useState<ChatContactDto[]>([]);
  const [hospitalRooms, setHospitalRooms] = useState<HospitalChatRoomDto[]>([]);
  const [hasLoadedHospitalRooms, setHasLoadedHospitalRooms] = useState(false);

  const [createdRoomIds, setCreatedRoomIds] = useState<
    ReadonlyMap<string, number>
  >(() => new Map());

  const [contactPage, setContactPage] = useState(0);
  const [hasNextContactPage, setHasNextContactPage] = useState(false);
  const [isContactPageLoading, setIsContactPageLoading] = useState(false);

  // 같은 상대방을 빠르게 여러 번 선택했을 때
  // 채팅방 생성 요청이 중복 호출되는 것을 방지한다.
  const roomCreationRequestsRef = useRef(new Map<string, Promise<number>>());

  const initialRoomId = searchParams.get('roomId') ?? 'request';

  const rooms = useMemo(() => {
    if (!hasLoadedHospitalRooms) {
      return [requestChatRoom];
    }

    // 서버에서 받아온 실제 채팅 대상들을 1:1 채팅 카드로 변환한다.
    const contactRooms = mergeHospitalContactsWithRooms(
      contacts,
      hospitalRooms,
      createdRoomIds,
    );

    // URL로 특정 roomId에 직접 들어온 경우 현재 페이지 목록에 없어도 보여준다.
    const requestedHospitalRoom = hospitalRooms.find(
      (hospitalRoom) => String(hospitalRoom.roomId) === initialRoomId,
    );

    const requestedRoomIsVisible = requestedHospitalRoom?.target.userId
      ? contactRooms.some(
          (room) => room.targetUserId === requestedHospitalRoom.target.userId,
        )
      : contactRooms.some(
          (room) => room.chatRoomId === requestedHospitalRoom?.roomId,
        );

    return [
      // 요청 카드는 그대로 둔다.
      requestChatRoom,

      // 회원가입한 다른 계정이 getChatContacts에 내려오면
      // 이곳에 별도 카드로 추가된다.
      ...contactRooms,

      ...(requestedHospitalRoom && !requestedRoomIsVisible
        ? [mapHospitalChatRoomDtoToChatRoom(requestedHospitalRoom)]
        : []),
    ];
  }, [
    contacts,
    createdRoomIds,
    hasLoadedHospitalRooms,
    hospitalRooms,
    initialRoomId,
  ]);

  // 기존에 생성되어 있는 HOSPITAL 채팅방 조회
  useEffect(() => {
    let isMounted = true;

    const loadHospitalChatRooms = async () => {
      try {
        const loadedHospitalRooms = await getHospitalChatRooms();

        if (isMounted) {
          setHospitalRooms(loadedHospitalRooms);
        }
      } catch {
        if (isMounted) {
          setHospitalRooms([]);
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

  // 실제 채팅 가능한 상대 목록 조회
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
        }
      } catch {
        if (isMounted) {
          setContacts([]);
          setHasNextContactPage(false);
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

  // 실제 사용자 카드를 선택하면 해당 사용자와 1:1 채팅방을 조회/생성한다.
  const handleHospitalRoomSelect = useCallback(async (room: ChatRoom) => {
    // 이미 실제 채팅방이 있으면 별도 생성 불필요
    if (room.chatRoomId) {
      return room;
    }

    // 요청 카드는 targetUserId가 없으므로 현재는 그대로 둔다.
    if (!room.targetUserId) {
      return;
    }

    const targetUserId = room.targetUserId;

    let roomRequest = roomCreationRequestsRef.current.get(targetUserId);

    if (!roomRequest) {
      roomRequest = createOrGetHospitalChatRoom(targetUserId).then(
        ({ roomId }) => roomId,
      );

      roomCreationRequestsRef.current.set(targetUserId, roomRequest);
    }

    try {
      const roomId = await roomRequest;

      setCreatedRoomIds((current) => {
        const next = new Map(current);
        next.set(targetUserId, roomId);
        return next;
      });

      // 실제 roomId가 생긴 ChatRoom을 PatientChatView에 반환
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
      messagePath="/patient?source=hospital-message"
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
