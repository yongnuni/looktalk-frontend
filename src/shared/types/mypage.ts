/** 친구 (환자 - 친구 목록 관리) */
export interface Friend {
  id: number;
  name: string;
  phone: string;
}

/** 자주 쓰는 문장 */
export interface Phrase {
  id: number;
  text: string;
  category: string | null;
  createdAt: string;
}

/** 담당 환자 (의료진) */
export interface ManagedPatient {
  /** 내부 사용자 ID. 담당 관계 해제(DELETE) 시 사용 */
  userId: string;
  loginId: string;
  /** 서버 displayName/name 우선순위 적용 결과 (환자 본인이 설정한 이름) */
  displayName: string;
  /** 이 STAFF만 보는 개인 별칭. 없으면 null (표시할 땐 displayName으로 대체) */
  alias: string | null;
  assignedAt: string;
}

/** 비상호출 내역 1건 */
export interface EmergencyCall {
  id: number;
  room: string;
  patientName: string;
  /** 이미 "00시 00분" 형태로 포맷된 문자열 */
  calledAt: string;
  /** 연속 호출 횟수 (시간차가 벌어지면 1로 리셋) */
  count: number;
}
