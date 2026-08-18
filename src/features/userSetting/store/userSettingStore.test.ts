import { describe, expect, it } from 'vitest';
import { useUserSettingStore } from './userSettingStore';
import type { UserSettingDto } from '../../../shared/types/backend';

const BASE_SETTINGS: UserSettingDto = {
  keyboardLayout: 'QWERTY',
  keyEnlarged: false,
  currentInputMethod: 'EYE_TRACKING',
};

// Front Step 17 §32 — Input Method 저장 성공/실패가 store에 정확히 반영되는지 확인한다.
// 실제 GET/PATCH 호출은 useUserSettings 훅이 담당하므로(§4/§30), 여기서는 그 훅이
// 호출하는 setSettings/setError가 store 상태를 올바르게 바꾸는지만 검증한다.
describe('userSettingStore', () => {
  it('4. setSettings(PATCH 성공 응답)를 호출하면 currentInputMethod가 즉시 갱신된다', () => {
    useUserSettingStore.getState().setSettings(BASE_SETTINGS);
    expect(useUserSettingStore.getState().settings?.currentInputMethod).toBe('EYE_TRACKING');

    useUserSettingStore.getState().setSettings({ ...BASE_SETTINGS, currentInputMethod: 'MOUTH' });
    expect(useUserSettingStore.getState().settings?.currentInputMethod).toBe('MOUTH');
    expect(useUserSettingStore.getState().status).toBe('loaded');
  });

  it('5. setError(PATCH 실패)를 호출해도 이전에 저장된 settings 값은 성공으로 오인되지 않는다(status가 error로 바뀐다)', () => {
    useUserSettingStore.getState().setSettings({ ...BASE_SETTINGS, currentInputMethod: 'BLINK' });

    useUserSettingStore.getState().setError('네트워크 오류');

    const state = useUserSettingStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('네트워크 오류');
    // 실패해도 store는 마지막으로 확인된 값을 임의로 EYE_TRACKING 등으로 되돌리지 않는다
    // (실패를 성공으로 오인하게 만드는 롤백/추측성 상태 변경이 없어야 한다).
    expect(state.settings?.currentInputMethod).toBe('BLINK');
  });

  it('reset() 호출 시 계정 전환 경계에서 currentInputMethod 캐시가 완전히 비워진다', () => {
    useUserSettingStore.getState().setSettings(BASE_SETTINGS);
    useUserSettingStore.getState().reset();

    const state = useUserSettingStore.getState();
    expect(state.settings).toBeNull();
    expect(state.status).toBe('idle');
  });
});
