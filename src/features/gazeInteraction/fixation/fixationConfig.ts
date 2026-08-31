/**
 * 고정(fixation) 감지 기반 히트박스 확장 설정.
 *
 * Look-Talk 원본: src/config.py 76-131행(`FIXATION_*`, `VIEWING_DISTANCE_CM`,
 * `PX_PER_DEG`)을 그대로 옮긴 값이다. 각도 기준 임계값(°/s, °)만 원본과 같고,
 * px 환산 기준은 Web에 맞춰 바꿨다 — 아래 CSS_PX_PER_CM 주석 참고.
 *
 * 시간 단위는 원본이 초, 여기서는 ms다. GazeFrame.now가 performance.now() 계열의
 * ms이고 DwellController/BlinkController/MouthController가 전부 ms로 판정하므로
 * 시계를 하나로 맞춘다(원본에서 dwell과 고정 판정이 같은 time.time()을 쓰는 것과
 * 같은 이유).
 */

/** 눈~화면 실제 거리(cm). 측정 환경이 바뀌면 이 값을 수정한다. */
export const VIEWING_DISTANCE_CM = 60.0;

/**
 * CSS px 기준 px_per_cm.
 *
 * 원본은 모니터 대각 인치를 손으로 입력해 `대각 px / 대각 cm`으로 구했다
 * (config.py 24-31행). Web은 CSS 명세상 1인치 = 96 CSS px로 고정돼 있어
 * 모니터 정보를 물어보지 않아도 되고, 이 레이어가 다루는 좌표(cursorCssPx,
 * getBoundingClientRect)가 전부 CSS px이므로 좌표계도 저절로 일치한다.
 */
export const CSS_PX_PER_CM = 96 / 2.54;

/** 시야각 1°가 화면에서 차지하는 CSS px. 속도(°/s)·분산(°) 임계값의 px 환산에 쓴다. */
export const PX_PER_DEG =
  2.0 * VIEWING_DISTANCE_CM * Math.tan((0.5 * Math.PI) / 180) * CSS_PX_PER_CM;

export const FIXATION_HITBOX_ENABLED = true;

/**
 * I-VT: 점간 이동 속도가 이 값 이하로 떨어지면 고정 후보.
 * 연구에서 쓰이는 5~50°/s 범위의 중간값.
 */
export const FIXATION_VELOCITY_DEG_PER_SEC = 30.0;

/** I-DT: 고정 중심에서 이 반경 안에 머물러야 고정으로 본다(체스 연구 기준 약 1°). */
export const FIXATION_DISPERSION_DEG = 1.0;

/**
 * 고정 성립에 필요한 최소 지속 시간(100~200ms 범위).
 * dwell 판정(DwellController의 1.2s)보다 훨씬 짧아야 dwell이 차기 전에 확장이 걸린다.
 */
export const FIXATION_MIN_DURATION_MS = 150;

/**
 * 고정 해제 반경. 성립 이후에는 조금 관대하게 두어 미세한 흔들림 때문에
 * 확장이 켜졌다 꺼졌다 하지 않게 한다(히스테리시스).
 */
export const FIXATION_RELEASE_DEG = 1.5;

/**
 * 프레임 간격이 이보다 크면(페이지 전환·캘리브레이션 등으로 프레임 구독이 끊긴 경우)
 * 연속된 시선으로 이어 붙이지 않고 고정 상태를 새로 시작한다.
 */
export const FIXATION_MAX_GAP_MS = 300;

/**
 * 확장량 = 키 한 변 x 이 비율(각 변 바깥으로).
 * 0.5면 판정 폭이 "키 폭 + 키 폭"(= 2배)이 된다.
 */
export const FIXATION_HITBOX_EXPAND_RATIO = 0.5;

/**
 * 확장이 인접 키를 덮을 수 있는 최대 깊이(그 키 한 변 대비 비율).
 * 겹치는 구간에서는 확장된 쪽이 이기므로, 인접 키가 통째로 먹히지 않도록
 * 침범 깊이를 제한한다. 1/3이면 인접 키의 나머지 2/3는 그대로 남는다.
 */
export const FIXATION_HITBOX_MAX_OVERLAP_RATIO = 1 / 3;

/** 고정된 키캡을 화면에서도 실제로 키울지. 끄면 판정 영역만 넓어진다. */
export const FIXATION_VISUAL_EXPAND_ENABLED = true;

/**
 * 시각 확대 비율. 히트박스 비율보다 작게 두면 "보이는 것보다 판정이 조금 더
 * 너그러운" 암묵 확장이 된다. 침범 한도(1/3)는 시각 확대에도 똑같이 걸리므로
 * 인접 키가 통째로 가려지지 않는다.
 */
export const FIXATION_VISUAL_EXPAND_RATIO = 0.35;

/**
 * 확대 애니메이션 길이(ms). 80~150ms의 짧은 1회성 ease-out —
 * 없으면 반응 체감이 약하고, 길거나 반복되면 시각 유발성 멀미 리스크가 커진다.
 */
export const FIXATION_VISUAL_ANIM_MS = 120;
