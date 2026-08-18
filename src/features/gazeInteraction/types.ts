/**
 * Front Step 12/13/14 — Global Gaze Target Registry.
 *
 * MAIN: MainPage 등 일반 PATIENT 화면(Memo/Phrase/Analysis/MyPage/FriendList/PhoneVerify).
 * 페이지별로 별도 scope를 늘리지 않는다 — 페이지 unmount 시 그 페이지의 target이 전부
 * unregister되므로, 같은 이름의 scope를 여러 페이지가 재사용해도 서로 섞이지 않는다.
 * CHAT: 채팅 목록/채팅방(HospitalChatPage/FriendChatPage/PatientChatView) navigation.
 * KEYBOARD: VirtualKeyboard가 열려 있는 동안(Chat 내부 오버레이든 `/patient` QA route든).
 * MODAL: gaze로 확인/취소해야 하는 중요 모달(Emergency 카운트다운 등)이 열려 있는 동안.
 */
export type InteractionScope = 'MAIN' | 'CHAT' | 'KEYBOARD' | 'MODAL';

/**
 * Registry에 보관되는 target 항목. `enabledRef`/`onSelectRef`는 값이 아니라 ref
 * 객체(`{current: T}`)를 그대로 저장한다 — 최신 콜백을 매 프레임 참조하기 위해서다
 * (state 값이 바뀔 때마다 등록을 다시 하지 않도록, useGazeTarget에서 ref-mirroring으로
 * 갱신하는 것을 registry는 읽기만 한다).
 */
export interface GazeTargetEntry {
  id: string;
  scope: InteractionScope;
  element: HTMLElement;
  enabledRef: { current: boolean };
  onSelectRef: { current: () => void };
}
