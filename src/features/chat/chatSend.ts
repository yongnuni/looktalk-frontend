import { encryptMemo } from '../../shared/utils/e2ee';
import { getCurrentUserId } from '../../shared/utils/jwt';
import type { SendChatRoomMessageDataDto } from '../../shared/types/backend';
import { sendChatRoomMessage } from './api/chatRooms';
import { ensureE2eeKey, getUserPublicKey } from './api/e2eeKeys';

/**
 * Front Step 14 §22 — Keyboard Confirm에서 공백만 있는 메시지는 보내지 않는다. Backend도
 * SMS 경로에서 동일 정책을 갖고 있지만(COMMON_VALIDATION_ERROR), Front에서 먼저 걸러
 * 불필요한 요청/E2EE 암호화를 만들지 않는다.
 */
export function isSendableMessage(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * Front Step 14 §17/§20 — 실제 CHAT-006 REST 전송 경로(sendChatRoomMessage)를 그대로
 * 재사용한다. HOSPITAL room은 Backend가 활성 내부 participant 전원(현재 항상 나 + 상대
 * 1명)의 ciphertext를 요구하므로(ChatMessageService.sendHospitalMessage), 내 공개키와
 * 상대 공개키로 각각 sealed box 암호화한다. `encryptMemo`는 이름과 달리 알고리즘
 * 자체는 범용 LIBSODIUM_SEALED_BOX 암호화라 그대로 재사용한다(암호화 코드를 중복
 * 작성하지 않는다).
 */
export async function sendHospitalChatMessage(
  roomId: number,
  targetUserId: string,
  text: string,
): Promise<SendChatRoomMessageDataDto> {
  const trimmed = text.trim();
  if (!isSendableMessage(trimmed)) {
    throw new Error('EMPTY_MESSAGE');
  }

  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    throw new Error('세션 정보를 확인할 수 없습니다. 다시 로그인해 주세요.');
  }

  const myKey = await ensureE2eeKey();
  const targetKey = await getUserPublicKey(targetUserId);

  const [ciphertextForMe, ciphertextForTarget] = await Promise.all([
    encryptMemo(trimmed, myKey.publicKey, myKey.keyVersion),
    encryptMemo(trimmed, targetKey.publicKey, targetKey.keyVersion),
  ]);

  return sendChatRoomMessage(roomId, {
    messageType: 'TEXT',
    ciphertexts: [
      {
        recipientUserId: currentUserId,
        keyVersion: myKey.keyVersion,
        algorithm: ciphertextForMe.algorithm,
        ciphertext: ciphertextForMe.ciphertext,
      },
      {
        recipientUserId: targetUserId,
        keyVersion: targetKey.keyVersion,
        algorithm: ciphertextForTarget.algorithm,
        ciphertext: ciphertextForTarget.ciphertext,
      },
    ],
  });
}

/**
 * Front Step 14 §20 — SMS room은 Backend가 서버 측에서 평문을 받아 직접 암호화/발송한다
 * (ChatMessageService.sendSmsMessage) — Frontend가 상대 공개키를 다룰 필요가 없다. 다만
 * PATIENT 본인의 활성 E2EE 키는 여전히 필요하므로(자기 자신에게 남기는 이력 사본) 먼저
 * 확인만 한다.
 */
export async function sendFriendChatMessage(roomId: number, text: string): Promise<SendChatRoomMessageDataDto> {
  const trimmed = text.trim();
  if (!isSendableMessage(trimmed)) {
    throw new Error('EMPTY_MESSAGE');
  }

  await ensureE2eeKey();

  return sendChatRoomMessage(roomId, {
    messageType: 'TEXT',
    content: trimmed,
  });
}
