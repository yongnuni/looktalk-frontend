import type {
  BlinkCalibrationResult,
  MouthCalibrationResult,
} from './inputCalibration';
import {
  selectInputTestWord,
  type InputMethodTestResult,
  type InputTestMethod,
} from './inputMethodTest';
import type { GazeCalibrationResult } from './types';

export type PatientCalibrationStage =
  | 'GAZE_RUNNING'
  | 'GAZE_INPUT_TEST'
  | 'BLINK_RUNNING'
  | 'BLINK_INPUT_TEST'
  | 'MOUTH_RUNNING'
  | 'MOUTH_INPUT_TEST'
  | 'REVIEW'
  | 'SAVING'
  | 'COMPLETE';

export interface PatientInputTestTargets {
  gaze: string | null;
  blink: string | null;
  mouth: string | null;
}

export interface PatientInputTestResults {
  gaze: InputMethodTestResult | null;
  blink: InputMethodTestResult | null;
  mouth: InputMethodTestResult | null;
}

export interface PatientCalibrationFlowSnapshot {
  stage: PatientCalibrationStage;
  gaze: GazeCalibrationResult | null;
  blink: BlinkCalibrationResult | null;
  mouth: MouthCalibrationResult | null;
  inputTestTargets: PatientInputTestTargets;
  inputTests: PatientInputTestResults;
}

type RandomSource = () => number;

/** 각 단계 재시도 시 앞 단계의 캘리브레이션과 입력 테스트 결과를 보존한다. */
export class PatientCalibrationFlow {
  private stage: PatientCalibrationStage = 'GAZE_RUNNING';
  private gaze: GazeCalibrationResult | null = null;
  private blink: BlinkCalibrationResult | null = null;
  private mouth: MouthCalibrationResult | null = null;
  private inputTestTargets: PatientInputTestTargets = {
    gaze: null,
    blink: null,
    mouth: null,
  };
  private inputTests: PatientInputTestResults = {
    gaze: null,
    blink: null,
    mouth: null,
  };
  private readonly random: RandomSource;

  constructor(random: RandomSource = Math.random) {
    this.random = random;
  }

  completeGaze(result: GazeCalibrationResult): void {
    if (this.stage !== 'GAZE_RUNNING') {
      return;
    }

    this.gaze = result;
    this.inputTestTargets.gaze = this.pickInputTestTarget();
    this.stage = 'GAZE_INPUT_TEST';
  }

  completeInputTest(result: InputMethodTestResult): void {
    if (!this.isValidInputTestResult(result)) {
      return;
    }

    if (this.stage === 'GAZE_INPUT_TEST' && result.method === 'GAZE') {
      this.inputTests.gaze = result;
      this.stage = 'BLINK_RUNNING';
      return;
    }

    if (this.stage === 'BLINK_INPUT_TEST' && result.method === 'BLINK') {
      this.inputTests.blink = result;
      this.stage = 'MOUTH_RUNNING';
      return;
    }

    if (this.stage === 'MOUTH_INPUT_TEST' && result.method === 'MOUTH') {
      this.inputTests.mouth = result;
      this.stage = 'REVIEW';
    }
  }

  retryBlink(): void {
    if (this.gaze === null || this.inputTests.gaze === null) {
      return;
    }

    this.blink = null;
    this.mouth = null;
    this.inputTestTargets.blink = null;
    this.inputTestTargets.mouth = null;
    this.inputTests.blink = null;
    this.inputTests.mouth = null;
    this.stage = 'BLINK_RUNNING';
  }

  completeBlink(result: BlinkCalibrationResult): void {
    if (this.stage !== 'BLINK_RUNNING') {
      return;
    }

    this.blink = result;
    this.inputTestTargets.blink = this.pickInputTestTarget();
    this.stage = 'BLINK_INPUT_TEST';
  }

  retryMouth(): void {
    if (
      this.gaze === null ||
      this.blink === null ||
      this.inputTests.gaze === null ||
      this.inputTests.blink === null
    ) {
      return;
    }

    this.mouth = null;
    this.inputTestTargets.mouth = null;
    this.inputTests.mouth = null;
    this.stage = 'MOUTH_RUNNING';
  }

  completeMouth(result: MouthCalibrationResult): void {
    if (this.stage !== 'MOUTH_RUNNING') {
      return;
    }

    this.mouth = result;
    this.inputTestTargets.mouth = this.pickInputTestTarget();
    this.stage = 'MOUTH_INPUT_TEST';
  }

  startSaving(): void {
    if (this.stage === 'REVIEW') {
      this.stage = 'SAVING';
    }
  }

  savingFailed(): void {
    if (this.stage === 'SAVING') {
      this.stage = 'REVIEW';
    }
  }

  complete(): void {
    if (this.stage === 'SAVING') {
      this.stage = 'COMPLETE';
    }
  }

  restartGaze(): void {
    this.stage = 'GAZE_RUNNING';
    this.gaze = null;
    this.blink = null;
    this.mouth = null;
    this.inputTestTargets = { gaze: null, blink: null, mouth: null };
    this.inputTests = { gaze: null, blink: null, mouth: null };
  }

  private pickInputTestTarget(): string {
    const usedWords = new Set(
      Object.values(this.inputTestTargets).filter((word): word is string => word !== null),
    );
    return selectInputTestWord(usedWords, this.random);
  }

  private isValidInputTestResult(result: InputMethodTestResult): boolean {
    const key: Record<InputTestMethod, keyof PatientInputTestTargets> = {
      GAZE: 'gaze',
      BLINK: 'blink',
      MOUTH: 'mouth',
    };
    const target = this.inputTestTargets[key[result.method]];
    return target !== null && result.targetWord === target && result.finalInput === target;
  }

  getSnapshot(): PatientCalibrationFlowSnapshot {
    return {
      stage: this.stage,
      gaze: this.gaze,
      blink: this.blink,
      mouth: this.mouth,
      inputTestTargets: { ...this.inputTestTargets },
      inputTests: { ...this.inputTests },
    };
  }
}
