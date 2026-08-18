import type { KeyTarget } from '../multimodalInput/types';

/** container 내부의 `data-key-id`가 달린 렌더링된 key 요소들을 viewport CSS px 중심으로 수집한다. */
export function collectKeyTargets(container: HTMLElement): KeyTarget[] {
  const elements = container.querySelectorAll<HTMLElement>('[data-key-id]');
  const targets: KeyTarget[] = [];

  elements.forEach((el) => {
    const id = el.dataset.keyId;
    if (!id) return;

    const rect = el.getBoundingClientRect();
    targets.push({
      id,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    });
  });

  return targets;
}
