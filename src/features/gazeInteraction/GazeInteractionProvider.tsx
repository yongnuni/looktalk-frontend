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
import { KeyboardFixationLayer } from './fixation/KeyboardFixationLayer';
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
  // 고정 감지형 히트박스 확장(Look-Talk src/tracking/fixation.py). registry/controller와
  // 마찬가지로 provider가 인스턴스 하나만 소유한다.
  const fixationLayerRef = useRef(new KeyboardFixationLayer());
  const inputModeRef = useRef(inputMode);
  const activeScopeRef = useRef<InteractionScope>(initialScope);
  const lastHoveredElementRef = useRef<HTMLElement | null>(null);
  const lastUiUpdateRef = useRef(0);

  const [activeScope, setActiveScopeState] = useState<InteractionScope>(initialScope);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [mouthOpen, setMouthOpen] = useState<boolean | null>(null);

  useEffect(() => {
    inputModeRef.current = inputMode;
    dwellControllerRef.current.reset();
    fixationLayerRef.current.reset();
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
    // eslint의 ref-in-cleanup 경고를 피하려고 effect 안에서 한 번만 읽는다 —
    // 이 ref는 DOM node가 아니라 provider가 소유한 단일 인스턴스라 바뀌지 않는다.
    const fixationLayer = fixationLayerRef.current;

    const handleFrame = (frame: GazeFrame) => {
      const scope = activeScopeRef.current;
      const eligibleTargets = filterEligibleTargets(registryRef.current.values(), scope);

      // BLINK에서 눈이 완전히 열려 있지 않은 프레임은 좌표가 무효라 갱신하면 앵커가
      // 풀린다 — 사용자가 "선택됨"으로 인지하는 확대가 깜빡이는 순간 사라졌다가 눈을 뜬 뒤
      // 최소 지속 시간만큼 지나야 돌아온다. update() 호출 자체를 건너뛰면 앵커·측정 rect·
      // inline transform이 그대로 얼어붙어 확대와 확장 히트박스가 깜빡임 동안 유지된다.
      //
      // eyeClosed만으로는 부족하다. 눈꺼풀이 내려오는 구간은 EAR이 아직 close threshold
      // 위라 eyeClosed가 false인데도 confidence가 0이라 cursorCssPx가 이미 null이다 —
      // 그 프레임에서 갱신하면 깜빡임 시작마다 확대가 한 번 튄다.
      const blinkHold =
        inputModeRef.current === 'BLINK' &&
        frame.signal !== null &&
        (frame.signal.eyeClosed || frame.cursorCssPx === null);

      // 고정 판정은 dwell 상태·cooldown과 무관한 독립 레이어라 selection보다 먼저
      // 매 프레임 갱신한다(Look-Talk dwell.py가 cooldown early-return 앞에서
      // fixation_hitbox.update()를 호출하는 것과 같은 위치).
      if (!blinkHold) {
        fixationLayer.update(
          scope,
          eligibleTargets,
          frame.hasSignal ? frame.cursorCssPx : null,
          frame.now,
        );
      }

      const selectionTargets = frame.hasSignal
        ? buildSelectionTargets(
            scope,
            eligibleTargets,
            frame.cursorCssPx,
            fixationLayer.resolveHit,
          )
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

    const unsubscribe = subscribeFrame(handleFrame);

    return () => {
      unsubscribe();
      // 구독이 끊기면 확대된 키캡의 inline transform이 그대로 남지 않게 되돌린다.
      fixationLayer.reset();
    };
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
