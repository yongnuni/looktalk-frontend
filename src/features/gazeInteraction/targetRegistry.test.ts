import { describe, expect, it } from 'vitest';
import { createTargetRegistry } from './targetRegistry';
import type { GazeTargetEntry } from './types';

function fakeEntry(id: string, overrides: Partial<GazeTargetEntry> = {}): GazeTargetEntry {
  return {
    id,
    scope: 'MAIN',
    element: {} as HTMLElement,
    enabledRef: { current: true },
    onSelectRef: { current: () => {} },
    ...overrides,
  };
}

describe('createTargetRegistry', () => {
  it('1. register → registry에 존재', () => {
    const registry = createTargetRegistry();
    registry.register(fakeEntry('a'));
    expect(registry.get('a')).not.toBeNull();
    expect(registry.values()).toHaveLength(1);
  });

  it('2. unregister → 제거', () => {
    const registry = createTargetRegistry();
    registry.register(fakeEntry('a'));
    registry.unregister('a');
    expect(registry.get('a')).toBeNull();
    expect(registry.values()).toHaveLength(0);
  });

  it('3. 동일 id로 다시 register하면 중복 없이 최신 값으로 덮어쓴다', () => {
    const registry = createTargetRegistry();
    const first = fakeEntry('a', { onSelectRef: { current: () => 'first' } });
    const second = fakeEntry('a', { onSelectRef: { current: () => 'second' } });

    registry.register(first);
    registry.register(second);

    expect(registry.values()).toHaveLength(1);
    expect(registry.get('a')).toBe(second);
  });

  it('14. unregister 이후에는 stale entry를 조회할 수 없다(콜백이 실행될 방법이 없음)', () => {
    const registry = createTargetRegistry();
    let called = false;
    registry.register(fakeEntry('a', { onSelectRef: { current: () => { called = true; } } }));
    registry.unregister('a');

    const target = registry.get('a');
    target?.onSelectRef.current();

    expect(called).toBe(false);
  });

  it('없는 id를 unregister해도 에러 없이 무시된다', () => {
    const registry = createTargetRegistry();
    expect(() => registry.unregister('missing')).not.toThrow();
  });
});
