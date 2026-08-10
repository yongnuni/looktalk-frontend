export const ROUTES = {
  // 공통 / 인증
  LOGIN: '/login',
  SIGNUP: '/signup',
  PASSWORD_RESET: '/reset-password',

  STAFF_LOGIN: '/staff-login',
  STAFF_SIGNUP: '/staff-signup',
  STAFF_PASSWORD_RESET: '/staff-reset-password',

  // 환자
  MAIN: '/main',
  MEMO: '/memo',
  CHAT_HOSPITAL: '/chat/hospital',
  CHAT_FRIEND: '/chat/friend',
  ANALYSIS: '/analysis',

  MYPAGE: '/mypage',
  MYPAGE_FRIENDS: '/mypage/friends',
  MYPAGE_PHONE_VERIFY: '/mypage/phone-verify',
  MYPAGE_PHRASES: '/mypage/phrases',

  // 의료진
  STAFF_CHAT: '/staff/chat',
  STAFF_MYPAGE: '/staff/mypage',
  STAFF_PROFILE: '/staff/mypage/profile',
  STAFF_PATIENTS: '/staff/mypage/patients',
  STAFF_EMERGENCY_LOG: '/staff/mypage/emergency-calls',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
