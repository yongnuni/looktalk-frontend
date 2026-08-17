// users
export interface UserDto {
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  profile_image: string | null;
  is_email_verified: boolean | null;
  is_sms_verified: boolean | null;
  login_id: string | null;
  role: 'PATIENT' | 'STAFF' | null;
  created_at: string | null;
}

// user_setting
export interface UserSettingDto {
  user_id: string;
  keyboard_layout: string | null;
  is_key_enlarged: boolean | null;
  current_input_method: string | null;
  updated_at: string | null;
}

// phrase
export interface PhraseDto {
  phrase_id: number;
  user_id: string | null;
  phrase_text: string;
  category: string | null;
  created_at: string | null;
}

// friendship
export interface FriendshipDto {
  friendship_id: number;
  user_id: string | null;
  friend_user_id: string | null;
  status: string | null;
  friend_name: string | null;
  friend_phone: string | null;
  created_at: string | null;
}

// memo
export interface MemoDto {
  memo_id: number;
  user_id: string | null;
  content: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// chat_room
export interface ChatRoomDto {
  room_id: number;
  room_type: string | null;
  created_at: string | null;
}

// chat_participant
export interface ChatParticipantDto {
  participant_id: number;
  room_id: number;
  user_id: string | null;
  external_name: string | null;
  external_phone: string | null;
  joined_at: string | null;
}

// message
export interface MessageDto {
  message_id: number;
  room_id: number;
  sender_participant_id: number;
  content: string;
  message_type: string | null;
  created_at: string | null;
}

// input_session_log
export interface InputSessionLogDto {
  log_id: string;
  user_id: string | null;
  calibration_id: string | null;
  input_method: string;
  keyboard_layout: string;
  typo_rate: number | null;
  input_speed: number | null;
  recognition_accuracy: number | null;
  input_stability: number | null;
  session_at: string | null;
}

// hospital
export interface HospitalDto {
  hospital_id: number;
  hospital_name: string;
  created_at: string | null;
}

// staff
export interface StaffDto {
  staff_id: number;
  user_id: string;
  hospital_id: number;
  created_at: string | null;
}

// GET /staff/me/patients
export interface StaffAssignedPatientDto {
  userId: string;
  loginId: string;
  name: string | null;
  displayName: string;
  assignedAt: string;
}

// GET /friends
export interface SmsFriendshipDto {
  friendshipId: number;
  name: string;
  phone: string;
}

// chat room list API
export interface HospitalChatRoomTargetDto {
  type: string;
  userId: string;
  name: string;
  displayName: string | null;
  phone: string | null;
}

export interface HospitalChatRoomDto {
  roomId: number;
  roomType: 'HOSPITAL';
  target: HospitalChatRoomTargetDto;
  lastMessageEncryptedPayload: unknown | null;
  lastMessageAt: string | null;
}

// GET /chat-contacts
export type ChatContactRole = 'PATIENT' | 'STAFF';

export interface ChatContactDto {
  userId: string;
  role: ChatContactRole;
  name: string | null;
  displayName: string | null;
  e2eeReady: boolean;
}

export interface ChatContactsDataDto {
  content: ChatContactDto[];
  hasNext: boolean;
}

// POST /chat-rooms/hospital
export interface CreateOrGetHospitalChatRoomRequestDto {
  targetUserId: string;
}

export interface CreateOrGetHospitalChatRoomDataDto {
  roomId: number;
  roomType: 'HOSPITAL';
  createdAt: string;
}

// POST /chat-rooms/sms
export interface CreateOrGetSmsChatRoomRequestDto {
  friendshipId: number;
}

export interface SmsChatRoomDto {
  roomId: number;
  roomType: string;
  createdAt: string;
}

export interface EncryptedPayloadDto {
  algorithm: 'LIBSODIUM_SEALED_BOX';
  keyVersion: number;
  ciphertext: string;
}

export interface ChatRoomMessageDto {
  messageId: number;
  senderParticipantId: number;
  senderUserId: string;
  senderDisplayName: string;
  encryptedPayload: EncryptedPayloadDto;
  messageType: string;
  createdAt: string;
}

export interface ChatRoomMessagesDataDto {
  messages: ChatRoomMessageDto[];
  hasNext: boolean;
  nextCursor: number | null;
}

export interface ChatRoomMessageCiphertextDto {
  recipientUserId: string;
  keyVersion: number;
  algorithm: 'LIBSODIUM_SEALED_BOX';
  ciphertext: string;
}

export interface SendChatRoomMessageRequestDto {
  messageType: 'TEXT';
  ciphertexts: ChatRoomMessageCiphertextDto[];
}

export interface SendChatRoomMessageDataDto {
  messageId: number;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
}

// auth — AuthController/AuthService(AUTH-001/002/004)와 일치. purpose="SIGNUP"만 이번
// 범위(PATIENT signup)에서 다룬다 — PASSWORD_RESET의 confirm 응답은 { resetToken }으로
// 구조가 달라 PasswordResetPage.tsx가 별도로 갖고 있는 자체 구현을 그대로 둔다.
export type EmailVerificationPurpose = 'SIGNUP' | 'PASSWORD_RESET';

export interface EmailVerificationRequestDto {
  email: string;
  purpose: EmailVerificationPurpose;
}

export interface EmailVerificationResponseDto {
  expiresInSeconds: number;
}

export interface EmailVerificationConfirmRequestDto {
  email: string;
  purpose: EmailVerificationPurpose;
  code: string;
}

// purpose="SIGNUP"일 때의 confirm 응답(SignupVerificationResult.java)만 다룬다.
export interface SignupVerificationResultDto {
  verified: boolean;
}

export interface PatientSignupRequestDto {
  loginId: string;
  email: string;
  password: string;
}

export interface PatientSignupResponseDto {
  userId: string;
  loginId: string;
  role: string;
}
