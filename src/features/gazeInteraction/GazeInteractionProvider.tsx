import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useGazeRuntime, type GazeFrame } from '../gazeRuntime/GazeRuntimeContext';
import { BlinkController } from '../multimodalInput/BlinkController';
import { DwellController } from '../multimodalInput/DwellController';
import { processGazeFrameForSelection } from '../multimodalInput/gazeFrameSelection';
import { resolveGazeInputMode } from '../multimodalInput/gazeInputMode';
import { MouthController } from '../multimodalInput/MouthController';
import { useUserSettings } from '../userSetting/hooks/useUserSettings';
import { GazeInteractionContext, type GazeInteractionContextValue } from './GazeInteractionContext';
import { buildSelectionTargets } from './scopeSelectionTargets';
import { filterEligibleTargets } from './targetHitTest';
import { createTargetRegistry } from './targetRegistry';
import type { GazeTargetEntry, InteractionScope } from './types';

/**
 * Global Gaze Target Registry + Dwell/Blink/Mouth selection engine.
 *
 * GazeRuntimeProvider(Step 11)와 책임을 분리한다: Runtime은 tracking/좌표 생성만 담당하고,
 * 이 Provider가 target registry·hit detection·selection·action dispatch를 담당한다
 * (§4). Runtime의 `subscribeFrame()`을 구독해 매 프레임 처리하되, 각 input controller와
 * processGazeFrameForSelection을 공통으로 재사용한다. keyboard(useGazeSelection)와는
 * 완전히 별도의 인스턴스라 같은 프레임에서
 * 두 selection engine이 동시에 select를 낼 수 없다(서로 다른 registry/controller이며,
 * `/patient`는 이 registry에 아무 target도 등록하지 않는다, §16/J).
 */

const UI_UPDATE_INTERVAL_MS = 50;
const DEFAULT_SCOPE: InteractionScope = 'MAIN';

interface GazeInteractionProviderProps {
  children: ReactNode;
}

export function GazeInteractionProvider({ children }: GazeInteractionProviderProps) {
  const { subscribeFrame } = useGazeRuntime();
  // §18 — 새 API client를 만들지 않고 기존 useUserSettings()를 재사용한다. store의
  // status 가드 덕분에 PatientHomePage 등 다른 소비자와 중복 GET이 발생하지 않는다.
  const { settings } = useUserSettings();
  const inputMode = resolveGazeInputMode(settings?.currentInputMethod);

  const registryRef = useRef(createTargetRegistry());
  const dwellControllerRef = useRef(new DwellController());
  const blinkControllerRef = useRef(new BlinkController());
  const mouthControllerRef = useRef(new MouthController());
  const inputModeRef = useRef(inputMode);
  const activeScopeRef = useRef<InteractionScope>(DEFAULT_SCOPE);
  const lastHoveredElementRef = useRef<HTMLElement | null>(null);
  const lastUiUpdateRef = useRef(0);

  const [activeScope, setActiveScopeState] = useState<InteractionScope>(DEFAULT_SCOPE);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [mouthOpen, setMouthOpen] = useState<boolean | null>(null);

  useEffect(() => {
    inputModeRef.current = inputMode;
    dwellControllerRef.current.reset();
    blinkControllerRef.current.reset();
    mouthControllerRef.current.reset();
  }, [inputMode]);

  const registerTarget = useCallback((entry: GazeTargetEntry) => {
    registryRef.current.register(entry);
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    registryRef.current.unregister(id);
  }, []);

  const setActiveScope = useCallback((scope: InteractionScope) => {
    activeScopeRef.current = scope;
    setActiveScopeState(scope);
  }, []);

  // §22/§23 — hover 중인 target element에만 최소한의 시각 상태(data attribute + CSS
  // 변수)를 직접 다룬다. React state로 페이지 전체를 리렌더시키지 않기 위한 imperative
  // 갱신이다(§31) — MainPage 등은 이 값을 구독하지 않는다.
  const applyHoverVisual = useCallback((hoveredElement: HTMLElement | null, hoverProgress: number) => {
    const previous = lastHoveredElementRef.current;

    if (previous && previous !== hoveredElement) {
      previous.removeAttribute('data-gaze-hovered');
      previous.style.removeProperty('--gaze-progress');
    }

    if (hoveredElement) {
      hoveredElement.setAttribute('data-gaze-hovered', 'true');
      hoveredElement.style.setProperty('--gaze-progress', String(hoverProgress));
    }

    lastHoveredElementRef.current = hoveredElement;
  }, []);

  useEffect(() => {
    const handleFrame = (frame: GazeFrame) => {
      const eligibleTargets = filterEligibleTargets(registryRef.current.values(), activeScopeRef.current);

      const selectionTargets = frame.hasSignal
        ? buildSelectionTargets(activeScopeRef.current, eligibleTargets, frame.cursorCssPx)
        : [];

      const selection = processGazeFrameForSelection(
        frame,
        selectionTargets,
        inputModeRef.current,
        dwellControllerRef.current,
        blinkControllerRef.current,
        mouthControllerRef.current,
        new Set(eligibleTargets.map((target) => target.id)),
      );

      if (selection.selectedKeyId) {
        const target = registryRef.current.get(selection.selectedKeyId);
        target?.onSelectRef.current();
      }

      const hoveredEntry = selection.hoveredKeyId ? registryRef.current.get(selection.hoveredKeyId) : null;
      applyHoverVisual(hoveredEntry?.element ?? null, selection.progress);

      if (frame.now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
        lastUiUpdateRef.current = frame.now;
        setHoveredTargetId(selection.hoveredKeyId);
        setProgress(selection.progress);
        setMouthOpen(selection.mouthOpen ?? null);
      }
    };

    return subscribeFrame(handleFrame);
  }, [subscribeFrame, applyHoverVisual]);

  const value = useMemo<GazeInteractionContextValue>(
    () => ({
      registerTarget,
      unregisterTarget,
      hoveredTargetId,
      progress: inputMode === 'DWELL' ? progress : 0,
      activeScope,
      setActiveScope,
      inputMode,
      mouthOpen,
    }),
    [registerTarget, unregisterTarget, hoveredTargetId, progress, activeScope, setActiveScope, inputMode, mouthOpen],
  );

  return <GazeInteractionContext.Provider value={value}>{children}</GazeInteractionContext.Provider>;
}
