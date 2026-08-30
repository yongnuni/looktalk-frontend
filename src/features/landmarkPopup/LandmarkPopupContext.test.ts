import { describe, expect, it } from 'vitest';
import { landmarkPopupReducer, type LandmarkPopupState } from './LandmarkPopupContext';

describe('landmarkPopupReducer', () => {
  it('한 번에 하나의 variant만 활성화하고 다른 모드를 열면 교체한다', () => {
    let state: LandmarkPopupState = null;

    state = landmarkPopupReducer(state, { type: 'open', variant: 'full' });
    expect(state).toBe('full');

    state = landmarkPopupReducer(state, { type: 'open', variant: 'looktalk' });
    expect(state).toBe('looktalk');
  });

  it('닫기 동작은 popup 상태만 null로 변경한다', () => {
    const state = landmarkPopupReducer('full', { type: 'close' });
    expect(state).toBeNull();
  });
});
