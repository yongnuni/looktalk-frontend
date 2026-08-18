import { useCallback, useEffect, useRef } from 'react';
import KeyboardKey from './KeyboardKey';
import VirtualKeyboard from './VirtualKeyboard';
import { FUNCTION_KEY_CONFIRM } from '../layouts/qwertyLayouts';
import { useKeyboardGazeTargets } from '../useKeyboardGazeTargets';
import type { KeyboardState } from '../keyboardStateMachine';
import { usePhrases } from '../../phrase/hooks/usePhrases';
import './FullViewportKeyboardOverlay.css';

interface FullViewportKeyboardOverlayProps {
  ariaLabel: string;
  draftText: string;
  draftPlaceholder: string;
  errorMessage?: string | null;
  statusMessage?: string | null;
  onClose: () => void;
  closeDisabled?: boolean;
  keyboardState: KeyboardState;
  onKeySelect: (keyValue: string) => void;
  keyEnlarged?: boolean;
}

const PHRASE_KEY_PREFIX = 'phrase:';

// §4 — "자동완성"에 대응하는 실제 데이터 소스(Backend 도메인이든 Web 로컬 기능이든)를
// Python 3개 스냅샷(Look-Talk, Look-Talk-develop, Look-Talk-main)과 현재 looktalk-frontend/
// looktalk-backend 전체에서 찾지 못했다 — 없는 걸 새로 만들지 않는다(§4 "Backend API를
// 새로 만들지 않는다", "임의 mock 추천 문장을 넣지 않는다"). 자리(3 slot)는 제품 레이아웃
// 요구사항이라 예약하되, 텍스트/onClick 없이 비활성 placeholder로만 둔다.
const AUTOCOMPLETE_SLOT_COUNT = 3;

/**
 * Look-Talk keyboard.py 화면을 그대로 재현하는 공용 full-viewport 키보드 오버레이.
 * Memo/Hospital Chat/Friend Chat이 각자 modal/panel을 복제하지 않고 이 컴포넌트 하나를
 * 공유한다.
 *
 * 화면 구성(위→아래, 전부 flex:0 0 auto — flex-grow로 남는 공간을 자동 배분하지 않는다):
 * 상단 control row([닫기] [입력 문장] [확인]) → 추천 6슬롯(자동완성 3 — 실제 데이터
 * 소스가 없어 비활성 placeholder, 자주 쓰는 문장 3 — features/phrase의 기존
 * usePhraseStore 실데이터) → 숫자/자모 3행 → 기능행 → 하단 reserved 고정 영역(Studio/
 * 입력방식/상태 표시용, 60~85px 수준으로 제한 — flex:1로 남는 뷰포트 높이를 전부
 * 먹지 않는다).
 */
export default function FullViewportKeyboardOverlay({
  ariaLabel,
  draftText,
  draftPlaceholder,
  errorMessage,
  statusMessage,
  onClose,
  closeDisabled = false,
  keyboardState,
  onKeySelect,
  keyEnlarged = false,
}: FullViewportKeyboardOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { phrases, maxPhrases } = usePhrases();

  // 추천 버튼은 이미 Web에 존재하는 "자주 쓰는 문장"(usePhraseStore, MAX_PHRASES=3)을
  // 그대로 재사용한다 — 클릭/gaze 선택 시 그 문장을 한 글자씩 기존 onKeySelect(char)로
  // 흘려보내 Hangul 조합 상태머신을 그대로 통과시킨다(keyboardStateMachine은 건드리지 않는다).
  const handleKeySelectWithPhrases = useCallback(
    (keyValue: string) => {
      if (keyValue.startsWith(PHRASE_KEY_PREFIX)) {
        const phrase = phrases[Number(keyValue.slice(PHRASE_KEY_PREFIX.length))];
        if (!phrase) return;

        for (const char of phrase.text) {
          onKeySelect(char);
        }
        return;
      }

      onKeySelect(keyValue);
    },
    [phrases, onKeySelect],
  );

  const layoutSignature = `${keyboardState.isKorean}-${keyboardState.isShift}-${phrases.map((p) => p.id).join(',')}`;
  useKeyboardGazeTargets(containerRef, handleKeySelectWithPhrases, layoutSignature, true);

  const phraseSlots = Array.from({ length: maxPhrases }, (_, index) => phrases[index] ?? null);

  // 임시 디버그 로그(§8) — 브라우저 자동화 도구가 없어 실제 DOM geometry를 직접 찍어볼
  // 방법이 없다. dev 빌드에서만 최초 렌더 후 실측값을 콘솔에 출력한다. 확인 후 제거 요청 시
  // 바로 지운다.
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const container = containerRef.current;
    if (!container) return;

    const numericRow = container.querySelector('.keyboard-row--10');
    const firstKey = numericRow?.querySelector('.keyboard-key');
    const secondKey = numericRow?.querySelectorAll('.keyboard-key')[1];
    const functionRow = container.querySelector('.keyboard-row--function');
    const bottomReserved = container.querySelector('.fv-keyboard-bottom-reserved');

    const rect = (el: Element | null | undefined) => el?.getBoundingClientRect();
    const r1 = rect(firstKey);
    const r2 = rect(secondKey);

    console.table({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      numericRowWidth: rect(numericRow)?.width,
      firstKeyWidth: r1?.width,
      firstKeyHeight: r1?.height,
      keyGapX: r1 && r2 ? r2.left - r1.right : undefined,
      functionRowWidth: rect(functionRow)?.width,
      functionRowHeight: rect(functionRow)?.height,
      bottomReservedHeight: rect(bottomReserved)?.height,
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="fv-keyboard-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="fv-keyboard-topbar">
        <button
          type="button"
          className="fv-keyboard-close"
          onClick={onClose}
          disabled={closeDisabled}
        >
          닫기
        </button>
        <p className="fv-keyboard-draft">{draftText || draftPlaceholder}</p>
        <KeyboardKey value={FUNCTION_KEY_CONFIRM} onSelect={handleKeySelectWithPhrases} />
      </div>

      {errorMessage && (
        <p className="fv-keyboard-error" role="alert">
          {errorMessage}
        </p>
      )}
      {statusMessage && <p className="fv-keyboard-status">{statusMessage}</p>}

      {/* 추천 6슬롯 — 자동완성(비활성 placeholder, §4) + 자주 쓰는 문장(실데이터). 둘 다
          고정 개수로 렌더한다(목록 길이가 가변이면 useGazeTarget을 map 안에서 호출하게 돼
          hooks 규칙을 어긴다, PatientChatView의 room slot과 동일한 이유). */}
      <div className="fv-keyboard-recommend-group">
        <div className="fv-keyboard-recommend-row" aria-label="자동완성(준비 중)">
          {Array.from({ length: AUTOCOMPLETE_SLOT_COUNT }, (_, index) => (
            <span
              key={`autocomplete-${index}`}
              className="fv-keyboard-recommend-button fv-keyboard-recommend-button--empty"
            />
          ))}
        </div>
        <div className="fv-keyboard-recommend-row" aria-label="자주 쓰는 문장">
          {phraseSlots.map((phrase, index) =>
            phrase ? (
              <button
                key={phrase.id}
                type="button"
                className="fv-keyboard-recommend-button"
                data-key-id={`${PHRASE_KEY_PREFIX}${index}`}
                onClick={() => handleKeySelectWithPhrases(`${PHRASE_KEY_PREFIX}${index}`)}
              >
                {phrase.text}
              </button>
            ) : (
              <span
                key={`empty-phrase-${index}`}
                className="fv-keyboard-recommend-button fv-keyboard-recommend-button--empty"
              />
            ),
          )}
        </div>
      </div>

      <VirtualKeyboard
        keyboardState={keyboardState}
        onKeySelect={handleKeySelectWithPhrases}
        keyEnlarged={keyEnlarged}
      />

      {/* Studio/입력방식/Dwell·Fixation 등 상태 표시를 위해 예약된 고정 하단 영역 —
          flex:1로 남는 뷰포트 높이를 전부 흡수하지 않는다. */}
      <div className="fv-keyboard-bottom-reserved" aria-hidden="true" />
    </div>
  );
}
