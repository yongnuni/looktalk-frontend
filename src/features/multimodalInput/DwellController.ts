import type { InputSelectionState, KeyTarget } from './types';

/**
 * Look-Talk 원본: src/tracking/dwell.py DwellController를 그대로 포팅한다.
 * 단순 "포인트가 key 사각형 안에 있는가"가 아니라, 버튼 중심까지의 거리 기반
 * nearest-key + 반경 히스테리시스 방식이다.
 *
 * assist_radius=35px(신규 hover 후보 인식), lock_radius=40px(최초 lock)→60px(dwell 진행 중
 * 유지, dwell.py:57-60 — `self.dwell_key is not None`일 때만 60), dwell=1.2s(config.py
 * DWELL_SEC), click 후 cooldown=0.4s. cooldown_end는 reset()에서 지워지지 않는다(dwell.py의
 * reset()이 cooldown_end를 건드리지 않음 — 재확인 완료).
 */

const ASSIST_RADIUS_PX = 35;
const LOCK_RADIUS_LOCKED_PX = 60;
const LOCK_RADIUS_UNLOCKED_PX = 40;
const DWELL_SEC = 1.2;
const COOLDOWN_SEC = 0.4;

export class DwellController {
  private dwellKeyId: string | null = null;
  private dwellStartMs: number | null = null;
  private cooldownEndMs = 0;
  private hoverLockKeyId: string | null = null;

  reset(): void {
    this.dwellKeyId = null;
    this.dwellStartMs = null;
    this.hoverLockKeyId = null;
  }

  update(gazeX: number, gazeY: number, targets: KeyTarget[], nowMs: number): InputSelectionState {
    if (gazeX < 0 || gazeY < 0 || nowMs <= this.cooldownEndMs) {
      this.reset();
      return { hoveredKeyId: null, progress: 0, selectedKeyId: null };
    }

    let closest: KeyTarget | null = null;
    let closestDist = Infinity;

    for (const target of targets) {
      const dist = Math.hypot(gazeX - target.centerX, gazeY - target.centerY);
      if (dist < closestDist) {
        closestDist = dist;
        closest = target;
      }
    }

    const lockRadius = this.dwellKeyId !== null ? LOCK_RADIUS_LOCKED_PX : LOCK_RADIUS_UNLOCKED_PX;
    let hoveredKeyId: string | null = null;

    if (this.hoverLockKeyId !== null) {
      const locked = targets.find((t) => t.id === this.hoverLockKeyId);

      if (locked) {
        const lockDist = Math.hypot(gazeX - locked.centerX, gazeY - locked.centerY);

        if (lockDist < lockRadius) {
          hoveredKeyId = locked.id;
        } else {
          this.hoverLockKeyId = null;
        }
      } else {
        this.hoverLockKeyId = null;
      }
    }

    if (hoveredKeyId === null && closest !== null && closestDist < ASSIST_RADIUS_PX) {
      hoveredKeyId = closest.id;
      this.hoverLockKeyId = closest.id;
    }

    let progress = 0;
    let selectedKeyId: string | null = null;

    if (hoveredKeyId) {
      if (hoveredKeyId !== this.dwellKeyId) {
        this.dwellKeyId = hoveredKeyId;
        this.dwellStartMs = nowMs;
      } else {
        const elapsedSec = (nowMs - (this.dwellStartMs ?? nowMs)) / 1000;
        progress = Math.min(1, elapsedSec / DWELL_SEC);

        if (progress >= 1) {
          selectedKeyId = this.dwellKeyId;
          this.cooldownEndMs = nowMs + COOLDOWN_SEC * 1000;
          this.reset();
        }
      }
    } else {
      this.reset();
    }

    return { hoveredKeyId, progress, selectedKeyId };
  }
}
