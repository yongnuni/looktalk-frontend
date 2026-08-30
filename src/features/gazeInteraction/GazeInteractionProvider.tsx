import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  resolveBlinkThresholds,
  resolveMouthThresholds,
} from '../calibration/runtimeInputThresholds';
import { useCalibrationStore } from '../calibration/store/calibrationStore';
import {
  useGazeRuntime,
  type GazeFrame,
  type SubscribeGazeFrame,
} from '../gazeRuntime/GazeRuntimeContext';
import {
  BlinkController,
  type BlinkControllerThresholds,
} from '../multimodalInput/BlinkController';
import { DwellController } from '../multimodalInput/DwellController';
import { processGazeFrameForSelection } from '../multimodalInput/gazeFrameSelection';
import { resolveGazeInputMode, type GazeInputMode } from '../multimodalInput/gazeInputMode';
import {
  MouthController,
  type MouthControllerThresholds,
} from '../multimodalInput/MouthController';
import { useUserSettings } from '../userSetting/hooks/useUserSettings';
import { GazeInteractionContext, type GazeInteractionContextValue } from './GazeInteractionContext';
import { buildSelectionTargets } from './scopeSelectionTargets';
import { filterEligibleTargets } from './targetHitTest';
import { createTargetRegistry } from './targetRegistry';
import type { GazeTargetEntry, InteractionScope } from './types';

/**
 * Global Gaze Target Registry + Dwell/Blink/Mouth selection engine.
 *
 * Runtime은 tracking/좌표 생성만 담당하고, 이 provider가 target registry·hit detection·
 * selection·action dispatch를 담당한다. `/patient`와 calibration 입력 테스트 모두 아래
 * frame provider를 사용하므로 화면마다 별도 controller를 만들지 않는다.
 */

const UI_UPDATE_INTERVAL_MS = 50;
const DEFAULT_SCOPE: InteractionScope = 'MAIN';

interface GazeInteractionProviderProps {
  children: ReactNode;
}

interface GazeInteractionFrameProviderProps {
  children: ReactNode;
  subscribeFrame: SubscribeGazeFrame;
  inputMode: GazeInputMode;
  blinkThresholds?: BlinkControllerThresholds;
  mouthThresholds?: MouthControllerThresholds;
  initialScope?: InteractionScope;
}

export function GazeInteractionFrameProvider({
  children,
  subscribeFrame,
  inputMode,
  blinkThresholds,
  mouthThresholds,
  initialScope = DEFAULT_SCOPE,
}: GazeInteractionFrameProviderProps) {
  const registryRef = useRef(createTargetRegistry());
  const dwellControllerRef = useRef(new DwellController());
  const blinkControllerRef = useRef(new BlinkController(blinkThresholds));
  const mouthControllerRef = useRef(new MouthController(mouthThresholds));
  const inputModeRef = useRef(inputMode);
  const activeScopeRef = useRef<InteractionScope>(initialScope);
  const lastHoveredElementRef = useRef<HTMLElement | null>(null);
  const lastUiUpdateRef = useRef(0);

  const [activeScope, setActiveScopeState] = useState<InteractionScope>(initialScope);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    inputModeRef.current = inputMode;
    dwellControllerRef.current.reset();
    blinkControllerRef.current = new BlinkController(blinkThresholds);
    mouthControllerRef.current = new MouthController(mouthThresholds);
  }, [blinkThresholds, inputMode, mouthThresholds]);

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
    }),
    [registerTarget, unregisterTarget, hoveredTargetId, progress, activeScope, setActiveScope, inputMode],
  );

  return <GazeInteractionContext.Provider value={value}>{children}</GazeInteractionContext.Provider>;
}

/** `/patient` runtime과 저장된 사용자 입력 설정을 공통 frame provider에 연결한다. */
export function GazeInteractionProvider({ children }: GazeInteractionProviderProps) {
  const { subscribeFrame } = useGazeRuntime();
  const { settings } = useUserSettings();
  const inputMode = resolveGazeInputMode(settings?.currentInputMethod);
  const inputCalibration = useCalibrationStore((state) => state.inputCalibration);
  const blinkThresholds = useMemo(
    () => resolveBlinkThresholds(inputCalibration),
    [inputCalibration],
  );
  const mouthThresholds = useMemo(
    () => resolveMouthThresholds(inputCalibration),
    [inputCalibration],
  );

  return (
    <GazeInteractionFrameProvider
      subscribeFrame={subscribeFrame}
      inputMode={inputMode}
      blinkThresholds={blinkThresholds}
      mouthThresholds={mouthThresholds}
    >
      {children}
    </GazeInteractionFrameProvider>
  );
}
