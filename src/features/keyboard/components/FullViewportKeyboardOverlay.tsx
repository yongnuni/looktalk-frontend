import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import KeyboardKey from './KeyboardKey';
import VirtualKeyboard from './VirtualKeyboard';
import { FUNCTION_KEY_CONFIRM } from '../layouts/qwertyLayouts';
import { useKeyboardGazeTargets } from '../useKeyboardGazeTargets';
import type { KeyboardState } from '../keyboardStateMachine';
import KeyboardSuggestionRow from '../../autocomplete/KeyboardSuggestionRow';
import { useKeyboardSuggestions } from '../../autocomplete/useKeyboardSuggestions';
import { useLandmarkAutoOpen } from '../../landmarkPopup/useLandmarkAutoOpen';
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
  onSuggestionSelect?: (suggestion: string) => void;
  pendingWordBoundary?: boolean;
  suggestionsEnabled?: boolean;
  keyEnlarged?: boolean;
  showSuggestions?: boolean;
  showClose?: boolean;
  gazeTargetsEnabled?: boolean;
  pointerSelectionEnabled?: boolean;
  hoveredKeyId?: string | null;
  selectionProgress?: number;
  headerContent?: ReactNode;
  containerRef?: RefObject<HTMLDivElement | null>;
  autoLandmarkPopup?: boolean;
}

/**
 * Look-Talk keyboard.py 화면을 그대로 재현하는 공용 full-viewport 키보드 오버레이.
 * Memo/Hospital Chat/Friend Chat이 각자 modal/panel을 복제하지 않고 이 컴포넌트 하나를
 * 공유한다.
 *
 * 화면 구성(위→아래, 전부 flex:0 0 auto — flex-grow로 남는 공간을 자동 배분하지 않는다):
 * 상단 control row([닫기] [입력 문장] [확인]) → 추천 3슬롯(입력 전 자주 쓰는 문장,
 * 입력 중 초성 자동완성) → 숫자/자모 3행 → 기능행 → 하단 reserved 고정 영역(Studio/
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
  onSuggestionSelect,
  pendingWordBoundary = false,
  suggestionsEnabled = false,
  keyEnlarged = false,
  showSuggestions = true,
  showClose = true,
  gazeTargetsEnabled = true,
  pointerSelectionEnabled = true,
  hoveredKeyId = null,
  selectionProgress = 0,
  headerContent,
  containerRef: providedContainerRef,
  autoLandmarkPopup = true,
}: FullViewportKeyboardOverlayProps) {
  useLandmarkAutoOpen('looktalk', 'keyboard', undefined, autoLandmarkPopup);
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = providedContainerRef ?? internalContainerRef;
  const { slots, handleTargetSelect, suggestionSignature } = useKeyboardSuggestions({
    enabled: suggestionsEnabled,
    draftText,
    pendingWordBoundary,
    onKeySelect,
    onSuggestionSelect,
  });

  const layoutSignature = `${keyboardState.isKorean}-${keyboardState.isShift}-${suggestionSignature}`;
  useKeyboardGazeTargets(
    containerRef,
    handleTargetSelect,
    layoutSignature,
    gazeTargetsEnabled,
  );

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
  }, [containerRef]);

  return (
    <div
      ref={containerRef}
      className="fv-keyboard-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {headerContent}

      <div className={`fv-keyboard-topbar${showClose ? '' : ' fv-keyboard-topbar--no-close'}`}>
        {showClose && (
          <button
            type="button"
            className="fv-keyboard-close"
            onClick={onClose}
            disabled={closeDisabled}
          >
            닫기
          </button>
        )}
        <p className="fv-keyboard-draft">{draftText || draftPlaceholder}</p>
        <KeyboardKey
          value={FUNCTION_KEY_CONFIRM}
          hovered={hoveredKeyId === FUNCTION_KEY_CONFIRM}
          dwellProgress={hoveredKeyId === FUNCTION_KEY_CONFIRM ? selectionProgress : 0}
          onSelect={handleTargetSelect}
          pointerSelectionEnabled={pointerSelectionEnabled}
        />
      </div>

      {errorMessage && (
        <p className="fv-keyboard-error" role="alert">
          {errorMessage}
        </p>
      )}
      {statusMessage && <p className="fv-keyboard-status">{statusMessage}</p>}

      {/* 입력 전 자주 쓰는 문장과 입력 중 자동완성을 같은 3개 슬롯에 표시한다. */}
      {showSuggestions && (
        <div className="fv-keyboard-recommend-group">
          <KeyboardSuggestionRow
            slots={slots}
            mode={draftText ? 'autocomplete' : 'favorites'}
            onTargetSelect={handleTargetSelect}
          />
        </div>
      )}

      <VirtualKeyboard
        keyboardState={keyboardState}
        hoveredKeyId={hoveredKeyId}
        dwellProgress={selectionProgress}
        onKeySelect={handleTargetSelect}
        keyEnlarged={keyEnlarged}
        pointerSelectionEnabled={pointerSelectionEnabled}
      />

      {/* Studio/입력방식/Dwell·Fixation 등 상태 표시를 위해 예약된 고정 하단 영역 —
          flex:1로 남는 뷰포트 높이를 전부 흡수하지 않는다. */}
      <div className="fv-keyboard-bottom-reserved" aria-hidden="true" />
    </div>
  );
}
