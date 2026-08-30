import type { LandmarkPopupState, LandmarkPopupVariant } from './LandmarkPopupContext';

export interface LandmarkAutoOpenRequest {
  key: string;
  variant: LandmarkPopupVariant;
}

export interface LandmarkAutoOpenTransition {
  handled: boolean;
  variant: LandmarkPopupState;
}

/** 같은 key에서 X를 누른 상태와 다음 stage/session 재오픈을 React 밖에서 검증하는 상태기계. */
export class LandmarkAutoOpenController {
  private activeRequest: LandmarkAutoOpenRequest | null = null;
  private readonly dismissedKeys = new Set<string>();

  request(request: LandmarkAutoOpenRequest): LandmarkAutoOpenTransition {
    this.activeRequest = request;
    return {
      handled: true,
      variant: this.dismissedKeys.has(request.key) ? null : request.variant,
    };
  }

  release(key: string): LandmarkAutoOpenTransition {
    if (this.activeRequest?.key !== key) {
      return { handled: false, variant: null };
    }

    this.activeRequest = null;
    return { handled: true, variant: null };
  }

  dismissActive(): LandmarkAutoOpenTransition {
    if (this.activeRequest) {
      this.dismissedKeys.add(this.activeRequest.key);
    }
    return { handled: true, variant: null };
  }
}
