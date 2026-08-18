import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useGazeInteraction } from '../gazeInteraction/GazeInteractionContext';

/**
 * Front Step 13/14 §13 — VirtualKeyboard의 렌더링된 `[data-key-id]` DOM key를 Global Gaze
 * Target Registry(KEYBOARD scope)에 등록하는 adapter. VirtualKeyboard/KeyboardKey/
 * keyboardStateMachine/HangulComposer/DwellController/MouthController는 전혀 수정하지
 * 않는다 — 이미 있는 `collectKeyTargets`(domKeyTargets.ts)와 동일하게 컨테이너를
 * `querySelectorAll('[data-key-id]')`로 스윕하되, 그 결과를 (기존 `useGazeSelection`처럼)
 * 로컬 DwellController에 매 프레임 넘기는 대신 Global registry에 등록해 Global
 * DwellController/MouthController(§36, GazeInteractionProvider가 소유하는 단 하나의
 * 인스턴스) 하나가 처리하게 한다.
 *
 * key 목록은 layout(한/영, Shift)에 따라 달라지므로 `layoutSignature`가 바뀔 때마다
 * 다시 스캔해 이전 layout의 target을 전부 unregister하고 새 target을 등록한다 — 그렇지
 * 않으면 예를 들어 Shift를 눌러 'ㅂ'이 다른 자모로 바뀐 뒤에도 registry에 옛 'ㅂ' target이
 * 남아 존재하지 않는 DOM element를 가리키게 된다.
 *
 * `active=false`(예: Chat의 keyboard 오버레이가 닫힌 상태)면 스캔 자체를 건너뛰고 등록된
 * target을 전부 정리한다. `/patient` QA route처럼 keyboard가 항상 떠 있는 화면은
 * `active`를 항상 true로 넘긴다. `active`만 바뀌고 layoutSignature/onKeySelect는 그대로인
 * 경우(단순히 keyboard를 열었다 닫았다)에도 반드시 재정리되도록 의존성 배열에 포함한다 —
 * 그렇지 않으면 keyboard를 닫아도 registry에 KEYBOARD target이 남아(§37) 존재하지 않는
 * DOM을 가리키게 된다.
 */
export function useKeyboardGazeTargets(
  containerRef: RefObject<HTMLElement | null>,
  onKeySelect: (keyValue: string) => void,
  layoutSignature: string,
  active = true,
): void {
  const { registerTarget, unregisterTarget } = useGazeInteraction();

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) {
      return undefined;
    }

    const elements = container.querySelectorAll<HTMLElement>('[data-key-id]');
    const registeredIds: string[] = [];

    elements.forEach((element) => {
      const keyValue = element.dataset.keyId;
      if (!keyValue) {
        return;
      }

      const targetId = `keyboard:${keyValue}`;
      registerTarget({
        id: targetId,
        scope: 'KEYBOARD',
        element,
        enabledRef: { current: true },
        onSelectRef: { current: () => onKeySelect(keyValue) },
      });
      registeredIds.push(targetId);
    });

    return () => {
      registeredIds.forEach((id) => unregisterTarget(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- containerRef는 안정적인 ref 객체, layoutSignature/active가 실제 재스캔 트리거
  }, [active, layoutSignature, onKeySelect, registerTarget, unregisterTarget]);
}
