import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import type { ChatWebSocketEventDto } from '../types/backend';
import { getAccessToken, isJwtExpired } from './authToken';

export const CHAT_WEBSOCKET_PATH = '/ws';
export const CHAT_SUBSCRIPTION_DESTINATION = '/user/queue/chat';

interface ChatWebSocketConnectionHandlers {
  onConnect?: () => void;
  onError?: (error: Error) => void;
}

type ChatEventHandler = (event: ChatWebSocketEventDto) => void;

const activeClients = new Set<ChatWebSocketClient>();

function getChatWebSocketUrl(): string {
  const baseUrl = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8080';
  return `${baseUrl.replace(/\/$/, '')}${CHAT_WEBSOCKET_PATH}`;
}

function parseChatEvent(message: IMessage): ChatWebSocketEventDto | null {
  try {
    const event = JSON.parse(message.body) as Partial<ChatWebSocketEventDto>;

    if (
      event.type !== 'MESSAGE_CREATED' ||
      typeof event.roomId !== 'number' ||
      !event.data ||
      typeof event.data.messageId !== 'number'
    ) {
      return null;
    }

    return event as ChatWebSocketEventDto;
  } catch {
    return null;
  }
}

export class ChatWebSocketClient {
  private client: Client | null = null;
  private roomSubscription: StompSubscription | null = null;
  private selectedRoomId: number | null = null;
  private selectedRoomHandler: ChatEventHandler | null = null;
  private selectionVersion = 0;

  connect(handlers: ChatWebSocketConnectionHandlers = {}) {
    if (this.client?.active) return;

    const token = getAccessToken();
    if (!token) {
      handlers.onError?.(new Error('WebSocket 연결에 필요한 Access Token이 없습니다.'));
      return;
    }
    if (isJwtExpired(token)) {
      handlers.onError?.(new Error('만료된 Access Token으로 WebSocket에 연결할 수 없습니다.'));
      return;
    }

    const client = new Client({
      brokerURL: getChatWebSocketUrl(),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    });

    client.onConnect = () => {
      handlers.onConnect?.();
      this.subscribeSelectedRoom();
    };
    client.onStompError = (frame) => {
      client.reconnectDelay = 0;
      handlers.onError?.(
        new Error(frame.headers.message || 'STOMP 연결 또는 구독에 실패했습니다.'),
      );
    };
    client.onWebSocketError = () => {
      handlers.onError?.(new Error('WebSocket 연결에 실패했습니다.'));
    };
    client.onWebSocketClose = () => {
      this.roomSubscription = null;

      const currentToken = getAccessToken();
      if (!currentToken || isJwtExpired(currentToken)) {
        client.reconnectDelay = 0;
        handlers.onError?.(new Error('Access Token이 만료되어 WebSocket 연결이 종료되었습니다.'));
      }
    };

    this.client = client;
    activeClients.add(this);
    client.activate();
  }

  subscribeToRoom(roomId: number, handler: ChatEventHandler): () => void {
    this.unsubscribeFromRoom();

    const version = ++this.selectionVersion;
    this.selectedRoomId = roomId;
    this.selectedRoomHandler = handler;
    this.subscribeSelectedRoom();

    return () => {
      if (version === this.selectionVersion) {
        this.unsubscribeFromRoom();
      }
    };
  }

  disconnect() {
    this.unsubscribeFromRoom();

    const client = this.client;
    this.client = null;
    activeClients.delete(this);

    if (client) {
      void client.deactivate();
    }
  }

  private subscribeSelectedRoom() {
    if (
      !this.client?.connected ||
      this.roomSubscription ||
      this.selectedRoomId === null ||
      !this.selectedRoomHandler
    ) {
      return;
    }

    this.roomSubscription = this.client.subscribe(
      CHAT_SUBSCRIPTION_DESTINATION,
      (message) => {
        const event = parseChatEvent(message);

        if (
          event &&
          event.roomId === this.selectedRoomId &&
          this.selectedRoomHandler
        ) {
          this.selectedRoomHandler(event);
        }
      },
    );
  }

  private unsubscribeFromRoom() {
    this.selectionVersion += 1;
    this.roomSubscription?.unsubscribe();
    this.roomSubscription = null;
    this.selectedRoomId = null;
    this.selectedRoomHandler = null;
  }
}

export function disconnectAllChatWebSockets() {
  for (const client of [...activeClients]) {
    client.disconnect();
  }
}
