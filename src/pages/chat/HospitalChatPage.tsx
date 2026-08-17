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
