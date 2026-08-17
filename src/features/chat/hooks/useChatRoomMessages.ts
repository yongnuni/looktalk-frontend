import { useEffect, useRef, useState } from 'react';
import {
  ChatWebSocketClient,
} from '../../../shared/api/websocketClient';
import type { ChatWebSocketEventDto } from '../../../shared/types/backend';
import { prepareCurrentUserE2eeKey } from '../../../shared/api/e2eeKeys';
import { getChatRoomMessages } from '../api/chatRooms';
import {
  mapChatEventData,
  mapChatMessageDto,
} from '../api/chatMessages';
import type { ChatMessage } from '../types/chat';

interface UseChatRoomMessagesOptions {
  onMessageEvent?: (event: ChatWebSocketEventDto, message: ChatMessage) => void;
}

interface UseChatRoomMessagesResult {
  addMessage: (message: ChatMessage) => void;
  currentUserId: string | null;
  e2eeError: string | null;
  e2eeStatus: 'loading' | 'ready' | 'error';
  messages: ChatMessage[];
  realtimeAvailable: boolean;
  retryE2ee: () => void;
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const messagesById = new Map(current.map((message) => [message.id, message]));

  for (const message of incoming) {
    const existing = messagesById.get(message.id);
    if (
      !existing ||
      (existing.text === '메시지를 복호화할 수 없습니다.' &&
        message.text !== '메시지를 복호화할 수 없습니다.')
    ) {
      messagesById.set(message.id, message);
    }
  }

  return [...messagesById.values()].sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : Number.NaN;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : Number.NaN;

    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return Number(left.id) - Number(right.id);
  });
}

export function useChatRoomMessages(
  roomId: number | undefined,
  { onMessageEvent }: UseChatRoomMessagesOptions = {},
): UseChatRoomMessagesResult {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [e2eeStatus, setE2eeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [e2eeError, setE2eeError] = useState<string | null>(null);
  const [e2eeRetryCount, setE2eeRetryCount] = useState(0);
  const [messagesByRoomId, setMessagesByRoomId] = useState<Record<number, ChatMessage[]>>({});
  const [realtimeAvailable, setRealtimeAvailable] = useState(false);
  const clientRef = useRef<ChatWebSocketClient | null>(null);
  const onMessageEventRef = useRef(onMessageEvent);

  useEffect(() => {
    onMessageEventRef.current = onMessageEvent;
  }, [onMessageEvent]);

  useEffect(() => {
    let active = true;

    void prepareCurrentUserE2eeKey()
      .then((key) => {
        if (active) {
          setCurrentUserId(key.userId);
          setE2eeStatus('ready');
          setE2eeError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setCurrentUserId(null);
          setE2eeStatus('error');
          setE2eeError(
            error instanceof Error ? error.message : 'E2EE 키를 준비하지 못했습니다.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [e2eeRetryCount]);

  useEffect(() => {
    const client = new ChatWebSocketClient();
    clientRef.current = client;
    client.connect({
      onConnect: () => setRealtimeAvailable(true),
      onError: () => setRealtimeAvailable(false),
    });

    return () => {
      clientRef.current = null;
      client.disconnect();
    };
  }, []);

  useEffect(() => {
    if (roomId === undefined || !currentUserId || !clientRef.current) return;

    let active = true;
    const unsubscribe = clientRef.current.subscribeToRoom(roomId, (event) => {
      void mapChatEventData(event.data, currentUserId).then((message) => {
        if (!active) return;

        setMessagesByRoomId((current) => ({
          ...current,
          [roomId]: mergeMessages(current[roomId] ?? [], [message]),
        }));
        onMessageEventRef.current?.(event, message);
      });
    });

    void getChatRoomMessages(roomId, { size: 50 })
      .then(({ messages: history }) =>
        Promise.all(history.map((message) => mapChatMessageDto(message, currentUserId))),
      )
      .then((history) => {
        if (active) {
          setMessagesByRoomId((current) => ({
            ...current,
            [roomId]: mergeMessages(current[roomId] ?? [], history),
          }));
        }
      })
      .catch(() => {
        // REST 이력 조회 실패와 WebSocket 연결 실패는 기존 화면 렌더링을 중단하지 않는다.
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentUserId, roomId]);

  const addMessage = (message: ChatMessage) => {
    if (roomId === undefined) return;

    setMessagesByRoomId((current) => ({
      ...current,
      [roomId]: mergeMessages(current[roomId] ?? [], [message]),
    }));
  };

  const retryE2ee = () => {
    setE2eeStatus('loading');
    setE2eeError(null);
    setE2eeRetryCount((count) => count + 1);
  };

  return {
    addMessage,
    currentUserId,
    e2eeError,
    e2eeStatus,
    messages: roomId === undefined ? [] : (messagesByRoomId[roomId] ?? []),
    realtimeAvailable,
    retryE2ee,
  };
}
