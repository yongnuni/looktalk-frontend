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
  createdAt: number;
}

/** 담당 환자 (의료진) */
export interface ManagedPatient {
  id: number;
  /** Figma 기준 호실을 이름에 포함해 표기 ("101호 - 김민준"). 컬럼 분리 X */
  name: string;
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
