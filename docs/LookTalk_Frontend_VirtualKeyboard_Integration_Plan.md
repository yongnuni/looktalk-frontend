# LookTalk Frontend 가상키보드 · 캘리브레이션 통합 구현 계획

> 저장 권장 위치: `looktalk-frontend/docs/LookTalk_Frontend_VirtualKeyboard_Integration_Plan.md`
>
> 목적: 기존 Python `Look-Talk`의 실제 가상키보드/시선 입력 기능을 `looktalk-frontend` 웹 애플리케이션으로 이식하고, 로그인 → 캘리브레이션 → 입력 방식 선택 → 가상키보드 사용 → 분석 페이지 재측정 흐름을 실제 서비스 수준으로 연결하기 위한 구현 기준 문서이다.
>
> 이 문서는 Claude가 구현 전에 실제 코드와 대조하고, Step 단위로 구현·검증할 수 있도록 작성한다.

---

## 0. 이번 구현에서 확정된 제품 결정

다음 사항은 구현 시 임의로 변경하지 않는다.

1. 실제 서비스 런타임은 `looktalk-frontend` 브라우저 내부에서 동작한다.
2. Python `Look-Talk` 프로세스와 WebSocket/FastAPI 등으로 실시간 연결하지 않는다.
3. `Look-Talk` 저장소는 알고리즘과 키보드 동작의 레퍼런스로만 사용한다.
4. 브라우저에서는 `@mediapipe/tasks-vision`의 FaceLandmarker를 사용한다.
5. 키보드 레이아웃은 **QWERTY만 구현한다.** 천지인은 이번 범위에서 제외한다.
6. QWERTY 내부에는 다음 runtime state가 존재한다.
   - 한글 기본
   - 한글 Shift
   - 영문 기본
   - 영문 Shift
7. 웹 1차 시선 매핑은 Python Look-Talk의 기본 `raw` 방식만 포팅한다.
8. 다음 모드는 웹 1차 구현 범위에서 제외한다.
   - `pose_corrected`
   - `sqpnp_corrected`
   - `ridge_hybrid`
   - L2CS gaze backbone
   - 별도 head-pose 보정 모드
9. 따라서 웹 1차 캘리브레이션의 핵심 결과는 **iris x/y → 화면 좌표 Homography**이다.
10. 캘리브레이션은 로그인/새로고침마다 반복하지 않는다.
11. 정상적으로 적용된 캘리브레이션 결과는 Backend에 저장하고 이후 로그인/새로고침에서 재사용한다.
12. 재캘리브레이션은 분석 페이지의 키보드 아이콘 버튼에서 사용자가 명시적으로 시작한다.
13. 측정 결과 모달에는 **닫기(X) 버튼이 없다.**
14. 측정 결과 모달에서 사용자는 다음 중 하나를 반드시 수행한다.
   - 시선(gaze) 선택
   - 눈 깜빡임(blink) 선택
   - 입 움직임(mouth) 선택
   - 재측정
15. 입력 방식 선택이 성공적으로 저장되면 별도의 완료 모달을 표시한다.
16. 완료 모달의 `확인` 버튼을 누르면 분석 페이지로 이동한다.
17. `재측정`을 누르면 방금 측정한 candidate 결과를 적용하지 않고 캘리브레이션/측정 절차를 다시 시작한다.
18. 분석 페이지에서 재측정하는 동안에는 기존 active calibration/currentInputMethod를 유지한다.
19. 새 결과를 실제로 선택·적용하기 전까지 기존 정상 설정을 덮어쓰지 않는다.
20. 추천 단어 영역은 UI 공간만 고려한다. NLP 자동완성은 추후 기능이며 이번 구현에서 임의의 추천 로직을 만들지 않는다.
21. Backend의 `Recommendation`은 **입력 방식 추천**을 의미한다. NLP 단어 추천과 혼동하지 않는다.
22. Blink 입력 확정 로직은 기존 Python Look-Talk에 완성된 구현이 없으므로 별도 신규 설계 대상이다. UI에 항목이 존재한다는 이유만으로 fake 동작을 만들지 않는다.

---

# 1. Repository 역할

## 1.1 `Look-Talk/`

역할:

- 기존 Python 데스크톱 가상키보드 알고리즘 레퍼런스
- 시선 raw calibration
- gaze smoothing
- dwell
- mouth confirm
- QWERTY 상태 전이
- 한글 조합

실제 서비스 배포 런타임에는 포함하지 않는다.

다음 코드는 웹에서 직접 실행하지 않는다.

```text
cv2.VideoCapture
cv2.imshow
cv2.namedWindow
tkinter SCREEN_W / SCREEN_H
Python main loop
src/web 실험 스텁
```

## 1.2 `looktalk-frontend/`

실제 사용자 웹 런타임이다.

담당 범위:

```text
카메라 권한
FaceLandmarker
iris / EAR / MAR 추출
raw Homography 캘리브레이션
gaze smoothing
키 hit-test
dwell / mouth / 향후 blink confirm
QWERTY 렌더링
한글 조합
Backend API 연동
캘리브레이션 결과/입력방식 UX
분석 페이지 재측정
```

## 1.3 `looktalk-backend/`

Frontend가 직접 계산하지 않아야 하는 영속 데이터의 source of truth이다.

관련 범위:

```text
인증
UserSetting
Calibration persistence
InputSession
InputMethod Recommendation
```

---

# 2. 현재 Frontend에서 반드시 먼저 인지할 문제

현재 코드 조사에서 다음 문제가 확인되었다.

## 2.1 Access Token 저장 키 불일치

실제 Login 흐름은 다음 key를 사용한다.

```text
accessToken
tokenType
userRole
```

반면 `src/shared/api/apiClient.ts`는:

```text
looktalk_access_token
```

을 읽는다.

따라서 현재 상태에서는 로그인에 성공해도 일반 REST API의 `Authorization` 헤더가 비어 있을 수 있다.

**가상키보드 API 연동 전에 반드시 정합성을 고친다.**

Claude는 임의로 새 인증 체계를 만들지 말고 현재 Backend Auth 계약과 Front Login 구현을 읽은 뒤 한 key 체계로 통일한다.

## 2.2 Route Guard 없음

현재 `/patient`, `/calibration`, `/analysis`, `/staff` 등에 실제 로그인/role guard가 없다.

실서비스 흐름 구현 시 최소 다음을 분리한다.

```text
PublicRoute
AuthenticatedRoute
PatientRoute
StaffRoute
```

단, 이번 가상키보드 작업에서 기존 전체 라우팅을 과도하게 재설계하지 않는다. 필요한 범위부터 안전하게 적용한다.

## 2.3 UserSetting 타입 불일치 가능성

Frontend `shared/types/backend.ts`에는 snake_case 형태가 존재한다.

예:

```text
keyboard_layout
is_key_enlarged
current_input_method
```

Backend 실제 API DTO는 camelCase 계약이다.

```json
{
  "keyboardLayout": "QWERTY",
  "keyEnlarged": false,
  "currentInputMethod": "EYE_TRACKING"
}
```

Frontend는 DB column 명이 아니라 **실제 REST DTO 계약**을 사용한다.

---

# 3. 최종 Web Runtime Architecture

웹 1차 구현은 다음 파이프라인과 **좌표계 경계**로 고정한다. 각 화살표 옆에 해당 구간의 좌표 공간을 명시한다 — 이 경계를 넘길 때만 좌표 변환이 일어나고, 그 외 구간에서는 좌표 단위를 바꾸지 않는다.

```text
[Camera]
  getUserMedia
      ↓ (raw video frame)
[FaceLandmarker]
  @mediapipe/tasks-vision
      ↓ (정규화 landmark 0..1, 원본 or 미러 — §5.3에서 전략 확정)
[Landmark Normalizer]
  canonical mirrored coordinates (§5.3 전략 A/B 중 확정된 방식 적용)
      ↓ (정규화 0..1, canonical)
[Gaze Signal Extractor]
  irisX / irisY (정규화 0..1)
  EAR
  MAR
      ↓ (iris 정규화 0..1)
[Raw Calibration Mapper]
  16-point calibration
  Homography H : iris(0..1) → normalized viewport(0..1)
      ↓ (normalized viewport 0..1)
[Viewport Scaler]
  normalized viewport(0..1) × window.innerWidth/innerHeight (진짜 browser viewport,
  §7.5.1 — 임의 장식용 container 크기가 아니다)
      ↓ (viewport CSS px)
[Eye-Closed Gate]
  EAR 기반, BLINK confirm과 무관(§13.2) — 감은 프레임의 gaze를 이후 단계로 넘기지 않음
      ↓ (CSS px)
[Gaze Filter]  (§13 — 이 단계부터는 전부 CSS px에서 동작)
  moving average
  Kalman
  EMA
  dead zone
  fixation(optional UI/debug)
      ↓ (CSS px, 안정화된 gaze)
[Input Controller]
  EYE_TRACKING → dwell(nearest-key + assist/lock radius, §14.1)
  MOUTH → gaze lock + mouth confirm
  BLINK → 추후 신규 구현(confirm 트리거만, gate와는 별개)
      ↓ (selectedKeyId)
[VirtualKeyboard]
  QWERTY
  KO / EN
  Shift
  Space
  Del
  확인 → onConfirm()/onSubmit(text) (§15.4)
      ↓
[Text Composer]
  Korean jamo state machine
      ↓ (composedText)
[부모 Page]
  onConfirm/onSubmit 콜백을 받아 chat / memo / TTS 등 실제 동작 결정
  (VirtualKeyboard/Text Composer는 이 도메인 로직을 모른다)
```

---

# 4. 웹 1차 구현에서 제외할 알고리즘

다음 Python 기능은 현재 실제 서비스 요구에 필요하지 않으므로 웹으로 포팅하지 않는다.

```text
estimate_head_pose 기반 별도 보정 mode
SQPnP
pose_corrected
sqpnp_corrected
ridge_hybrid
18차원 feature vector
PolyRidgeMapper
L2CS backbone
pose_baseline 기반 보정
```

주의:

- FaceLandmarker에서 눈/입 랜드마크를 사용하는 것은 유지한다.
- EAR은 Blink 검출 기반으로 사용할 수 있다.
- MAR은 Mouth 입력에 사용한다.
- “head pose를 제외한다”는 뜻은 FaceLandmarker 자체를 단순화한다는 뜻이 아니다.

---

# 5. Camera / MediaPipe 설계

## 5.1 Camera

`src/features/camera`에 브라우저 카메라 계층을 만든다.

권장 책임:

```text
useCamera()
- permission: idle | requesting | granted | denied | error
- stream
- videoRef
- start()
- stop()
```

기본 constraint 예:

```text
video: {
  facingMode: "user"
}
```

해상도/FPS는 특정 기기에서 강제 실패하지 않도록 ideal 기준으로 요청한다.

## 5.2 FaceLandmarker

현재 `@mediapipe/tasks-vision` dependency만 있고 실제 설정은 없다.

따라서 다음이 필요하다.

```text
WASM runtime path
face_landmarker.task model
FilesetResolver
FaceLandmarker.createFromOptions
runningMode: VIDEO
detectForVideo(video, timestamp)
```

모델 asset 경로는 한 방식으로 통일한다.

권장:

```text
public/models/face_landmarker.task
```

WASM을 CDN에서 가져오는지 local asset으로 둘지는 기존 배포 정책을 확인한 후 결정한다.

## 5.3 Mirror 규칙

Python Look-Talk은 `cv2.flip(frame, 1)`을 **추론 이전** 원본 프레임에 적용한 뒤 FaceMesh를 실행한다 — 즉 모델 자체가 이미 미러링된 이미지를 본다.

웹에서 이를 그대로 재현하는 방법(추론 전 프레임 flip)과, 원본 프레임을 그대로 추론에 넣고 결과 landmark의 x만 사후 반전하는 방법(추론 후 좌표 flip)은 **수학적으로 항상 동일하다고 보장되지 않는다** — landmark 모델이 좌우 대칭적으로 완벽히 동일하게 동작할 때만 두 방식이 일치한다. 따라서 둘 중 하나를 여기서 임의로 확정하지 않고, 아래 두 전략을 모두 구현해 실제 카메라로 비교한 뒤 결정한다(**결과: §5.3 하단 "결정 방법" 참고, 전략 A로 확정됨**).

### 전략 후보

**전략 A — 추론 전 프레임 flip(Python과 동일 방식)**
```text
1. getUserMedia 원본 프레임을 canvas에 그리며 좌우 반전
2. 반전된 canvas를 FaceLandmarker.detectForVideo()에 입력
3. 결과 landmark는 이미 canonical(mirrored) 좌표
```

**전략 B — 추론 후 landmark 좌표 flip**
```text
1. FaceLandmarker는 원본(비반전) video frame을 그대로 입력받는다
2. 결과 landmark를 받은 직후 다음을 적용한다
   mirroredX = 1 - originalX
3. 이후 iris/EAR/MAR/calibration/debug overlay는 이 canonical coordinate만 사용한다
```

두 전략 모두 공통으로 지키는 불변 규칙:

- 화면 preview는 항상 사용자에게 거울처럼 보이도록 mirror한다.
- 한 파이프라인에서 X 반전을 두 번 적용하지 않는다(전략 A를 쓰면 B의 사후 반전을 추가로 하지 않고, 전략 B를 쓰면 canvas 단계에서 미리 뒤집지 않는다).

### 결정 방법 — 확정됨 (Front Step 0 PoC 결과)

`/dev/face-tracking`에서 전략 A/B를 실제 카메라로 비교한 결과, iris/EAR/MAR 안정성과 체감 FPS에서 유의미한 차이를 확인할 수 없었다.

```text
비교 기준(§5.3 원안)과 실제 결과:
- iris/EAR/MAR 안정성: A/B 간 유의미한 차이 없음
- 체감 FPS: A/B 간 유의미한 차이 없음
```

**따라서 Python `cv2.flip(frame, 1)` → FaceMesh 흐름과 직접 대응되는 전략 A(`PRE_INFERENCE_FRAME_FLIP`)를 최종 mirrorStrategy로 확정한다.** `DEFAULT_MIRROR_STRATEGY`(`mirrorStrategy.ts`)가 이 값으로 고정되어 있으며, 이후 Step(Raw Calibration 포함)은 전부 전략 A를 전제로 동작한다. 전략 B와 debug 토글 자체는 삭제하지 않고 개발 검증용으로 유지한다.

채택된 전략은 `GazeCalibrationResult.mirrorStrategy`(§7.7)에 기록해, 이후 전략이 바뀌면 기존 캘리브레이션이 무효화될 수 있음을 명시적으로 추적한다.

---

# 6. Gaze Signal Extractor

웹 1차 gaze mapping에는 raw iris만 사용한다.

Python Look-Talk과 동일한 iris index를 우선 검증한다.

```text
LEFT_IRIS  = 468, 469, 470, 471, 472
RIGHT_IRIS = 473, 474, 475, 476, 477
```

각 눈에서 5점 평균을 구하고 좌/우 평균을 다시 평균낸다.

개념:

```text
leftIris  = mean(landmark[468..472])
rightIris = mean(landmark[473..477])

irisX = (leftIris.x + rightIris.x) / 2
irisY = (leftIris.y + rightIris.y) / 2
```

출력:

```ts
interface GazeSignal {
  irisX: number; // normalized 0..1
  irisY: number; // normalized 0..1
  ear?: number;
  mar?: number;
  timestamp: number;
}
```

raw camera frame이나 전체 landmark history를 Backend에 저장하지 않는다.

---

# 7. Calibration 설계

## 7.1 Calibration의 의미

Calibration은 다음 기능이다.

```text
사용자의 iris 좌표
        ↓
웹 화면 gaze 좌표
```

입력 방식을 선택하는 기능과 분리한다.

즉:

```text
Calibration
= 어디를 보고 있는가

currentInputMethod
= 해당 key를 어떤 행위로 확정하는가
```

MOUTH 모드에서도 gaze로 key를 먼저 고르므로 동일한 gaze calibration을 사용한다.

향후 BLINK가 gaze-lock + blink-confirm 구조라면 동일 calibration을 사용한다.

## 7.2 16점

Python Look-Talk의 4×4 16점 구조를 유지한다.

```text
rows = 4
cols = 4
margin = 0.08
```

Calibration target 자체는 normalized viewport 좌표로 정의한다.

예:

```ts
interface NormalizedPoint {
  x: number; // 0..1
  y: number; // 0..1
}
```

**Calibration target의 렌더링 도메인은 FULL VIEWPORT 하나뿐이다 — "장식용 컨테이너 안에 그려도 된다"는 선택지는 없다.** (Front Step 1 coordinate audit에서 이 둘을 컨테이너 로컬 좌표로 혼동한 버그가 발견됐고, 뒤이어 "그럼 로컬로 그리고 변환만 하면 되지 않냐"는 절충안도 실제 요구사항 위반으로 판정되어 최종적으로 폐기됐다 — §7.5.1 참고.) 즉:

```text
rendered target coordinate == Homography destination coordinate == NORMALIZED_VIEWPORT
```

16점은 카드나 `.calibration-stage` 같은 작은 컨테이너 안이 아니라, **측정 시작과 동시에 뜨는 full-viewport 오버레이**(§7.5.1) 위에 `target.x/y`를 `left/top`(%, 오버레이 자체가 정확히 viewport 크기이므로 `vw`/`vh`와 동일)로 직접 렌더링한다. 좌표 변환 계층(로컬→viewport) 자체가 필요 없다.

```text
screenX = normalizedX * window.innerWidth   ← containerWidth가 아니라 항상 진짜 viewport.
screenY = normalizedY * window.innerHeight     타깃을 그리는 요소 자체가 viewport 전체를
                                                덮으므로 별도 좌표 변환이 필요 없다(§7.5.1).
```

## 7.3 타이밍

Python 기준을 초기값으로 가져온다.

```text
stabilize: 1.0 sec
collect:   2.0 sec
```

단, 웹에서 실측 FPS와 사용성을 보고 이후 조정할 수 있도록 상수화한다.

## 7.4 샘플 정제

초기 포팅 기준:

- point별 여러 iris sample 수집
- 극단값 일부 trim
- median 대표값 사용
- 불안정 점 재측정 가능

Python과 동일한 핵심 의미를 유지하되, 웹용 threshold는 실측 후 확정한다.

Python의 `150px` 품질 기준을 브라우저 normalized coordinate에 그대로 하드코딩하지 않는다.

## 7.5 Homography 좌표 계약

**Backend에 저장하여 재사용해야 하므로 Homography 출력은 CSS px가 아니라 normalized viewport 좌표로 만든다.**

```text
input  = normalized iris x/y
output = normalized viewport x/y
```

따라서 저장된 H는 다음과 같이 재사용한다.

```text
iris (정규화 0..1)
 ↓
H
 ↓
normalized viewport gaze (0..1)
 ↓
window.innerWidth/innerHeight(진짜 browser viewport)와 곱함  ← 좌표계 경계: 이 지점
 ↓                                                              이후로만 CSS px
viewport CSS pixel gaze  ← GazeFilter(§13)는 여기서부터 시작한다
```

**"현재 container 크기"가 아니라 항상 `window.innerWidth`/`window.innerHeight`다** — 자세한 이유와 실제 발견된 버그는 §7.5.1 참고.

**좌표계 경계는 이 지점 하나로 고정한다.** Homography와 그 출력(normalized viewport)은 항상 0..1 정규화 값이고, Python Look-Talk의 px 기반 smoothing/fixation/dwell 파라미터(§13, §14.1)는 전부 이 CSS px 변환 **이후** 단계에서만 적용한다 — Homography 자체나 그 직후 단계에서 px 상수를 섞지 않는다.

새로고침이나 viewport 크기가 바뀌었다는 이유만으로 매번 재캘리브레이션하지 않는다. 다만 orientation 변경이나 큰 aspect-ratio 변화가 있었을 경우의 호환성 검증은 §8.5를 따른다.

## 7.5.1 "container ≠ viewport" 함정과 Full-Viewport Calibration 확정 (Front Step 1 coordinate audit로 확인된 실제 버그)

Front Step 1 구현 직후 감사에서, 16점 타깃과 결과 커서를 카드 안의 `.calibration-stage`(장식용 컨테이너, viewport 전체가 아님) 내부에 로컬 0..1 좌표로 그리면서, **그 로컬 좌표를 그대로 `solveHomography()`의 destination으로 넘기던 버그**가 확인됐다. `/calibration`은 타깃과 커서를 같은 컨테이너 안에서 그리고 검증하므로 self-consistent해 보였지만, 학습된 H는 실제로는 "browser viewport 정규화"가 아니라 "그 장식용 컨테이너 로컬 정규화"였다.

1차 수정으로 "로컬 렌더링은 유지하고 `getBoundingClientRect()`로 Homography destination만 viewport로 변환"하는 절충안을 시도했으나, 이 절충안 자체가 **제품 요구사항 위반으로 최종 폐기됐다** — 캘리브레이션 target은 (변환 후 좌표가 맞든 틀리든) 애초에 작은 카드 영역이 아니라 **Python Look-Talk처럼 사용자가 실제로 화면 전체 범위에 시선을 이동**해야 하기 때문이다. 최종 확정된 계약은 다음과 같다.

**고정 계약(이후 모든 Step이 따라야 함):**

```text
1. Calibration target 렌더링 domain = FULL VIEWPORT.
   CALIBRATION_GRID_POINTS(0.08~0.92, §7.2)를 그대로 렌더링 좌표로도, Homography
   destination으로도 쓴다 — 별도 변환 계층이 없다:

   rendered target coordinate == Homography destination coordinate == NORMALIZED_VIEWPORT

2. 측정 시작(user gesture) 시 full-viewport 오버레이를 띄운다(§7.5.2 — Browser Fullscreen API는 사용하지 않는다):

   position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 충분히 높게

   이 오버레이 안에서 target.x/y를 left/top(%)으로 직접 그린다 — 오버레이 자체가
   정확히 viewport 크기이므로 %와 vw/vh가 동일한 값이 된다.

3. Runtime(캘리브레이션 이후, GazeFilter 포함 전 구간)도 동일한 해석을 따른다:

iris → H → normalized viewport(0..1)
        ↓ 반드시 이 순서로 먼저 진짜 viewport px로 변환
viewportX = normalizedX * window.innerWidth
viewportY = normalizedY * window.innerHeight

4. Key hit-test(Step 2 이후, QWERTY 등)는 viewportX/viewportY를 key의
   getBoundingClientRect()와 "같은 좌표계"에서 직접 비교한다 — DOMRect도 이미
   viewport CSS px이므로 별도 변환이 필요 없다.

5. 특정 컨테이너 기준 local 좌표가 필요한 경우(있다면)에만, 그 다음 단계에서
   명시적으로 변환한다(calibration target 자체에는 해당하지 않는다):

containerLocalX = viewportX - containerRect.left
containerLocalY = viewportY - containerRect.top
```

측정 시작 **전** 안내 카드(설명 + 시작 버튼)는 기존 UI를 유지해도 된다 — 좌표 계약이 적용되는 건 측정 중/측정 후 화면뿐이다.

`calibratedViewport.widthPx/heightPx`(§7.7)는 **항상 `window.innerWidth`/`window.innerHeight`**를 기록한다 — 어떤 컨테이너의 `clientWidth`/`clientHeight`도 기록하면 안 된다(§8.5 호환성 판정이 실제 viewport 크기를 기준으로 해야 하기 때문). 이 값은 일반 브라우저 상태(주소창/탭이 보이는 상태)에서 그대로 측정한다(§7.5.2).

`NORMALIZED_VIEWPORT × 현재 container width/height`라는 표현이 이 문서 다른 곳에 남아 있다면, 그 "container"는 반드시 "실제 browser viewport(window.innerWidth/innerHeight)"를 뜻하는 것으로 읽어야 한다 — 임의의 컨테이너를 뜻하지 않는다.

## 7.5.2 Interaction Domain = Browser Content Viewport (Fullscreen API 미사용)

**중요한 제품 원칙**: Calibration은 실제 사용 interaction domain과 동일한 영역에서 수행한다.

```text
LookTalk Web v1 interaction domain = browser content viewport
                                      (window.innerWidth × window.innerHeight)

browser chrome(주소창, 탭 UI 등) 및 OS chrome(Windows taskbar 등)는
gaze interaction 대상이 아니다.
```

Front Step 1에서 한 차례 `document.documentElement.requestFullscreen()`을 시도하는 방식(Python Look-Talk의 `cv2` 전체화면 창과 동등한 효과를 노림)을 검토했으나 **제거했다.** 이유는 좌표계 정합성이 아니라 제품 원칙 때문이다 — 일반 사용자가 LookTalk을 평소 사용하는 브라우저 상태(주소창/탭이 보이는 일반 창)와 Calibration 환경이 달라지면, 캘리브레이션 때만 존재하던 조건(전체화면)이 실제 사용 시점에는 사라져 있는 불일치가 생긴다. 그래서:

- Calibration은 **항상 일반 browser viewport**(`window.innerWidth`/`window.innerHeight`, 주소창 아래부터 페이지 하단까지)에서 수행한다.
- Full-viewport 오버레이(§7.5.1, `position:fixed; inset:0; width:100vw; height:100vh`)는 그대로 유지한다 — 이건 "브라우저를 전체화면으로 만드는 것"이 아니라 "LookTalk 페이지 영역 전체를 캘리브레이션에 쓰는 것"이며, Browser Fullscreen API와는 무관하다.
- `requestFullscreen()`/`fullscreenchange` 감지/`exitFullscreen()` 관련 코드는 전부 제거한다. Fullscreen 진입을 기다린 뒤 측정을 시작하는 게이트도 없다 — 카메라/FaceLandmarker가 준비되면 바로 현재 viewport 크기를 기준으로 측정을 시작한다.

```text
사용자 시작 버튼
  ↓
카메라 권한/FaceLandmarker 준비
  ↓
현재 일반 browser viewport 크기 확정 (window.innerWidth/innerHeight)
  ↓
full-viewport overlay
  ↓
16점 측정 시작
```

**향후 확장 여지**: LookTalk 자체를 항상 Fullscreen/kiosk 모드로 실행하는 제품 모드가 생긴다면(예: 전용 단말 배포), 그때는 별도의 Calibration profile/정책으로 Fullscreen 진입을 다시 검토한다. Web v1 기본 Calibration에서는 사용하지 않는다.

## 7.6 Homography 구현

웹 1차에는 OpenCV.js 전체를 도입할 필요가 없다.

권장:

- 16개 correspondence를 이용한 8-parameter projective transform least-squares
- pure TypeScript 구현
- unit test 작성

필요 시 작은 선형대수 dependency를 추가할 수 있으나, dependency를 추가하기 전에 현재 package 구조를 확인한다.

## 7.7 Calibration 결과 내부 타입

```ts
interface GazeCalibrationResult {
  schemaVersion: 1;
  mappingType: 'RAW_HOMOGRAPHY';
  coordinateSpace: 'NORMALIZED_VIEWPORT';
  homography: [
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
  mirrorX: true;
  mirrorStrategy: 'PRE_INFERENCE_FRAME_FLIP' | 'POST_INFERENCE_LANDMARK_FLIP'; // §5.3 Step 0 PoC 결정값
  grid: {
    rows: 4;
    cols: 4;
    margin: 0.08;
  };
  calibratedViewport: {
    widthPx: number;
    heightPx: number;
    aspectRatio: number; // widthPx / heightPx
    orientation: 'portrait' | 'landscape';
  };
  reprojectionRmseNormalized?: number;
  createdAtLocal: string;
}
```

`createdAtLocal`은 frontend candidate 관리용이며 Backend DB 시각의 source of truth로 사용하지 않는다.

`calibratedViewport`/`mirrorStrategy`는 이번 단계에서 호환성 판정 로직(§8.5)에 쓰기 위해 **저장만** 한다 — 구체적인 재캘리브레이션 강제 threshold는 아직 만들지 않는다.

---

# 8. Calibration persistence

## 8.1 기본 정책

캘리브레이션은 한 번 정상 적용하면 Backend에 저장한다.

다음 상황에서는 기존 active calibration을 재사용한다.

```text
새로고침
로그아웃 후 재로그인
브라우저 재접속
일반 페이지 이동
```

사용자에게 매번 16점을 다시 보게 하지 않는다.

## 8.2 재측정 정책

분석 페이지의 키보드 아이콘을 통해 사용자가 명시적으로 재측정한다.

재측정 중에는 기존 active calibration을 유지한다.

새 candidate가 실제 선택·저장되기 전에는 기존 active calibration을 revoke하지 않는다.

## 8.3 Backend API adapter

Backend V9가 아직 구현 전일 수 있으므로 frontend 내부 domain model은 Backend의 컬럼 이름에 직접 종속시키지 않는다.

권장:

```text
CalibrationRepository interface
├─ getActiveGazeCalibration()
└─ saveActiveGazeCalibration(candidate)
```

실제 API adapter가 Backend 계약을 변환한다.

현재 Backend 계획이 `inputMethod=EYE_TRACKING`을 유지한다면 frontend adapter에서만:

```text
GAZE_CALIBRATION
→ EYE_TRACKING
```

으로 매핑한다.

MOUTH/Blink 사용자가 별도의 mouth/blink Homography를 찾지 않게 한다.

## 8.4 권장 calibrationData JSON

```json
{
  "schemaVersion": 1,
  "mappingType": "RAW_HOMOGRAPHY",
  "coordinateSpace": "NORMALIZED_VIEWPORT",
  "homography": [
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [0.0, 0.0, 1.0]
  ],
  "mirrorX": true,
  "mirrorStrategy": "PRE_INFERENCE_FRAME_FLIP",
  "grid": {
    "rows": 4,
    "cols": 4,
    "margin": 0.08
  },
  "calibratedViewport": {
    "widthPx": 1920,
    "heightPx": 1080,
    "aspectRatio": 1.777,
    "orientation": "landscape"
  },
  "reprojectionRmseNormalized": 0.0
}
```

Backend에는 raw frame, 전체 face landmark, 프레임별 iris sequence를 저장하지 않는다.

## 8.5 Viewport/Aspect-ratio 호환성 검증

Normalized homography는 특정 뷰포트 크기와 무관하게 재사용 가능하도록 설계했지만(§7.5), 시선-화면 매핑은 실제 물리적 눈-화면 기하에 의존하므로 **종횡비 자체가 크게 달라지면 재사용 정확도가 떨어질 수 있다.** 이를 임의 수치로 지금 확정하지 않고, 판정에 필요한 재료만 저장한다.

```text
저장 시점(§7.7 calibratedViewport):
  widthPx, heightPx, aspectRatio, orientation

재사용 시점 비교:
  현재 viewport의 widthPx/heightPx/aspectRatio/orientation을 계산
  저장된 값과 비교해 compatibility 상태를 판정

interface CalibrationCompatibility {
  status: 'compatible' | 'uncertain' | 'incompatible';
  orientationChanged: boolean;
  aspectRatioDelta: number; // |현재 - 저장값| / 저장값
}
```

- `orientationChanged=true`(portrait ↔ landscape 전환) 또는 `aspectRatioDelta`가 일정 기준 이상이면 최소 `'uncertain'`으로 판정한다.
- **구체적인 `aspectRatioDelta` 임계값과, `'uncertain'`/`'incompatible'`일 때 재캘리브레이션을 "권유"만 할지 "요구"할지는 지금 정하지 않는다** — 실제 기기/브라우저 조합에서 QA로 정확도 저하를 관찰한 뒤 확정한다. 1차 구현에서는 `'uncertain'` 이상이면 비침습적 재측정 권유 배너만 노출하고 사용은 막지 않는 것을 기본값으로 하되, 이 기본값 자체도 QA 결과로 뒤집을 수 있다.
- 이 판정 로직은 Front Step 5(Calibration persistence API 연결)에서 실제 GET 결과에 적용한다.

---

# 9. 최초 로그인 / 기존 사용자 Calibration Gate

## 9.1 PATIENT 로그인 후

실제 Auth가 정상화된 뒤 PATIENT만 calibration 여부를 검사한다.

개념 흐름:

```text
Login 성공
  ↓
PATIENT ?
  ↓ yes
GET active gaze calibration
  ↓
없음 ─────────────────────→ /calibration
있음
  ↓
호환성 판정(§8.5)
  ├─ compatible ─────────→ 일반 메인 흐름
  └─ uncertain/incompatible → 일반 메인 흐름 진입은 허용하되 재측정 권유 배너 노출(강제 아님, 기준 확정 전)
```

STAFF 로그인에는 이 gate를 적용하지 않는다.

## 9.2 새로고침

새로고침할 때 local memory에 calibration이 없다는 이유로 재측정을 시작하면 안 된다.

항상 Backend active calibration을 먼저 조회한다.

---

# 10. 측정 결과 모달 UX

디자인 기준:

```text
<측정 결과>
AI가 추천한 입력 방식은 “시선(gaze)”입니다!
사용하고 싶은 입력 방식을 선택해주세요.

[ 시선(gaze) ] [ 눈 깜빡임(blink) ] [ 입 움직임(mouth) ]

[ 재측정 ]
```

## 10.1 중요한 UX 규칙

- X/닫기 버튼 없음
- background click으로 닫히지 않음
- ESC로 닫히지 않음
- 사용자는 입력 방식 선택 또는 재측정 중 하나를 수행해야 함

## 10.2 상태

```ts
type MeasurementResultModalState =
  | 'IDLE'
  | 'SELECTING'
  | 'SAVING'
  | 'ERROR';
```

입력 방식:

```ts
type InputMethod = 'EYE_TRACKING' | 'BLINK' | 'MOUTH';
```

추천 결과:

```ts
recommendedInputMethod?: InputMethod;
```

실제 Recommendation API가 준비되지 않은 production 환경에서 추천값을 임의 생성하지 않는다.

## 10.3 입력 방식 선택 시 처리 순서

사용자가 예를 들어 `시선(gaze)`를 선택하면:

```text
1. selection button lock
2. candidate calibration 저장
3. UserSetting.currentInputMethod = EYE_TRACKING PATCH
4. 두 요청 모두 성공
5. 측정 결과 모달 종료
6. 설정 완료 모달 표시
```

권장 API 순서:

```text
Calibration POST
  ↓ success
UserSetting PATCH
  ↓ success
Success Modal
```

이유:

- 입력 방식만 바뀌고 calibration 저장이 실패하는 상태보다
- calibration이 저장되고 currentInputMethod PATCH를 재시도 가능한 상태가 복구하기 쉽다.

### 부분 실패 복구

Calibration POST 성공 후 UserSetting PATCH가 실패한 경우:

- 성공 모달을 띄우지 않는다.
- result modal에 error를 표시한다.
- 저장된 calibrationId를 local state에 유지한다.
- 재시도 시 동일 calibration을 또 POST하지 않고 PATCH만 재시도한다.

버튼 중복 클릭으로 POST가 여러 번 호출되지 않도록 한다.

## 10.4 재측정 선택

```text
재측정
 ↓
현재 candidate 폐기
 ↓
기존 active calibration은 그대로 유지
 ↓
measurement/calibration session reset
 ↓
16점 측정 재시작
```

최초 사용자에게 기존 active가 없다면 그냥 candidate만 폐기된다.

---

# 11. 설정 완료 모달 UX

디자인 기준:

```text
입력 방식이 설정되었습니다.
자세한 분석 결과는 분석페이지를 참고하세요!

[설정] → [분석페이지로 이동]

[ 확인 ]
```

규칙:

- X 버튼 없음
- 설정 저장이 실제로 성공한 뒤에만 표시
- `확인` 클릭 시 `/analysis`로 이동
- 성공 모달을 닫는 것 자체가 설정 저장 trigger가 아니다. 저장은 이미 완료된 상태여야 한다.

---

# 12. 분석 페이지 재캘리브레이션

분석 페이지에 존재하는 키보드 아이콘 버튼이 재측정 entry point이다.

## 12.1 흐름

```text
/analysis
  ↓
키보드 아이콘 클릭
  ↓
재측정 시작
  ↓
16점 calibration/measurement
  ↓
측정 결과 모달
  ├─ 입력 방식 선택 → 신규 calibration 저장 + currentInputMethod 갱신
  └─ 재측정 → 다시 측정
  ↓
설정 완료 모달
  ↓
확인
  ↓
/analysis
```

## 12.2 기존 active 보존

재측정 session 중:

```text
activeCalibration = 기존 값
candidateCalibration = 신규 메모리 값
```

사용자가 실제 입력 방식을 선택하고 저장 성공하기 전에는:

```text
activeCalibration
currentInputMethod
```

을 변경하지 않는다.

브라우저 뒤로가기/페이지 이탈로 candidate가 소실되어도 기존 설정은 유지되어야 한다.

---

# 13. GazeFilter

## 13.1 좌표 공간 고정

**GazeFilter는 정규화 좌표가 아니라 viewport CSS px에서 동작한다.** §3/§7.5/§7.5.1에서 고정한 경계대로, Homography의 normalized viewport(0..1) 출력은 GazeFilter에 들어오기 **직전**에 `window.innerWidth`/`window.innerHeight`(진짜 browser viewport — 임의 장식용 container가 아님, §7.5.1)를 곱해 viewport CSS px로 변환을 마친 상태여야 한다. 이 경계를 지키면 Python의 px 기반 상수(dead-zone/fixation/Kalman noise 등)를 좌표 공간 변환 없이 초기값 그대로 가져올 수 있다 — 정규화 공간에 그대로 적용하면 dead zone이 사실상 화면 전체를 덮는 값이 되어 완전히 다른 의미가 된다.

```text
[Homography] → normalized viewport(0..1)
      ↓ × window.innerWidth/innerHeight
[viewport CSS px 변환 완료]
      ↓
[Eye-Closed Gate] (§13.2)
      ↓
[GazeFilter 본체] (§13.3) ← 이 지점부터 전부 viewport CSS px
```

이후 key hit-test(Step 2 이후)는 이 viewport CSS px 값을 key의 `getBoundingClientRect()`(이미 viewport CSS px)와 **같은 좌표계에서 직접 비교**한다 — 별도 변환이 필요 없다(§7.5.1). 특정 컨테이너 기준 local 좌표가 필요한 특수한 경우에만 그 다음 단계에서 `containerLocalX = viewportX - containerRect.left`처럼 명시적으로 변환한다.

화면 실제 크기가 Python이 가정한 일반적인 모니터 해상도와 크게 다른 기기(초소형/초대형 화면)에서는 px 상수의 체감이 다를 수 있으므로, 그 경우에만 §13.3 상수를 화면 크기 비율로 보정하는 걸 PoC 이후 튜닝 대상으로 남긴다(지금 임의 공식을 확정하지 않는다).

## 13.2 Eye-Closed Gate(Blink confirm과 무관)

Python Look-Talk은 `blink`(EAR 기반 눈 감음 여부)를 `GazePipeline.update()`에 전달해, 눈을 감은 프레임에는 시선 추적 상태 전체를 리셋한다 — 이건 §14.3의 **BLINK confirm 입력방식과는 완전히 별개**의, "눈을 감은 동안 잘못된 iris 좌표가 gaze/dwell에 섞이지 않게 하는" 기본 안전장치다. BLINK confirm이 구현되기 전(Step 9 이전)에도 이 게이트는 반드시 필요하다.

```text
EAR 계산(§6, mediapipe 랜드마크 기반)
  ↓
EAR < close_threshold ?
  ├─ yes → 이 프레임의 gaze는 GazeFilter/Dwell/Mouth 어디에도 전달하지 않음(추적 상태 유지, 갱신만 skip)
  └─ no  → 정상적으로 §13.3 GazeFilter로 진행
```

- 이 게이트는 §3 파이프라인에서 GazeFilter 진입 직전(Viewport Scaler 이후, GazeFilter 본체 이전)에 위치한다.
- Front Step 2(GazeFilter + Dwell)에서 함께 구현한다 — Step 9(Blink confirm 신규 설계)까지 미루지 않는다.
- close/open threshold 초기값은 Python의 `close_threshold=0.18`/`open_threshold=0.22`(히스테리시스)를 참고값으로 가져오되, 개인별 보정은 이번 범위에 포함하지 않는다.

## 13.3 Smoothing 파라미터

초기값(§13.1의 CSS px 경계를 지킨 상태에서 그대로 적용):

```text
moving average window = 3
Kalman state = [x, y, vx, vy]
Kalman measurement = [x, y]
EMA alpha = 0.35
processNoiseCov ≈ I * 0.003
measurementNoiseCov ≈ I * 0.3
dead zone: movement<10px→10px, <40px→15px, else→25px
fixation radius = 40px, fixation frames = 6
max step = 50px
```

실제 체감은 PoC 후 튜닝한다.

## 13.4 State 저장 방식

고빈도 gaze point를 React state로 매 프레임 저장하지 않는다.

권장:

```text
useRef / class instance / module object
+ requestAnimationFrame
```

UI가 필요한 값만 제한적으로 Zustand/React state로 노출한다.

---

# 14. InputController

키보드는 입력 방식을 직접 알지 않는다.

공통 계약:

```ts
interface InputSelectionState {
  hoveredKeyId: string | null;
  progress: number;
  selectedKeyId: string | null;
}
```

## 14.1 EYE_TRACKING

Python Look-Talk의 기본 dwell 방식 포팅.

**단순 `DOMRect.contains(point)` 방식으로 구현하지 않는다.** Python `DwellController`는 사각형 포함 여부가 아니라 **버튼 중심까지의 거리 + 반경 히스테리시스**로 hover를 판정하며, 이 메커니즘 자체를 포팅 대상으로 명시한다.

초기값(Python 그대로):

```text
dwell = 1.2 sec
cooldown = 0.4 sec (dwell 확정 후 재입력 방지)
assist_radius = 35px  (신규 hover 후보를 인식하는 반경)
lock_radius   = 40px  (최초 hover-lock 성립 반경)
             → 60px  (이미 lock된 키를 유지하는 동안은 반경이 넓어지는 히스테리시스)
```

hit-test(nearest-key + hysteresis):

```text
gaze point
→ 모든 key 버튼과의 중심 거리 계산, 가장 가까운 버튼(closest) 선정
→ 기존 hover-lock 버튼이 있으면: 그 버튼과의 거리 < lock_radius(60px) 인 동안 hover 유지
→ hover-lock이 없으면: closest 버튼과의 거리 < assist_radius(35px) 일 때만 새로 lock, lock_radius를 40px로 시작
→ hover 성립 시에만 dwell 타이머 진행
→ dwell_sec(1.2s) 도달 시 selected key 확정 + cooldown(0.4s) 시작
```

hover가 성립하지 않는 프레임(어떤 버튼도 반경 안에 없음)에서는 dwell 상태 전체를 reset한다(진행률 0, lock 해제). 같은 키로 재진입해도 타이머는 이어지지 않고 0부터 다시 시작한다.

## 14.2 MOUTH

Python 동작 의미를 유지한다.

```text
gaze로 key 안정적으로 lock
  ↓
lock된 key 기억
  ↓
입을 벌림
  ↓
MAR hold
  ↓
lock된 key confirm
```

입을 벌린 순간의 gaze 좌표로 다시 key를 고르지 않는다.

초기 Python 참고값:

```text
gaze lock ≈ 0.25 sec
mouth hold ≈ 0.30 sec
cooldown ≈ 0.50 sec
```

개인별 MAR threshold calibration이 필요하면 별도 세부 Step으로 구현한다.

## 14.3 BLINK

Backend enum과 UI 선택지는 존재하지만 Python Look-Talk에는 실제 key confirm 구현이 없다.

**§13.2의 Eye-Closed Gate와 혼동하지 않는다.** 그 게이트는 "눈을 감은 동안 gaze를 무효화"하는, BLINK confirm과 무관하게 Step 2부터 이미 구현되어 있는 기능이다. 여기서 다루는 것은 그것과 별개로 "blink 동작 자체를 key 확정 신호로 사용"하는 새로운 confirm 방식이며, Python에 참고할 구현이 없어 신규 설계가 필요하다.

따라서:

- EYE_TRACKING 코드를 복사해 이름만 BLINK로 바꾸지 않는다.
- 자연 blink와 intentional blink를 구분할 UX/threshold를 별도 설계한다.
- 구현 완료 전 production에서 선택 가능 상태로 두지 않는다.
- Figma/UI 유지가 필요하면 disabled 상태 또는 feature flag를 사용한다.

최종 정책이 정해진 뒤 별도 Step으로 구현한다.

---

# 15. VirtualKeyboard

## 15.1 QWERTY만 구현

Backend `keyboardLayout`은 현재 QWERTY를 사용한다.

이번 범위에서는 다른 layout을 추가하지 않는다.

QWERTY 내부 state:

```ts
type KeyboardLanguage = 'KO' | 'EN';

type KeyboardRuntimeState = {
  language: KeyboardLanguage;
  shift: boolean;
};
```

`language`와 `shift`는 runtime state이며 Backend에 매 key press마다 저장하지 않는다.

## 15.2 레이아웃

Python QWERTY 동작을 기준으로:

### KO normal

```text
1 2 3 4 5 6 7 8 9 0
ㅂ ㅈ ㄷ ㄱ ㅅ ㅛ ㅕ ㅑ ㅐ ㅔ
ㅁ ㄴ ㅇ ㄹ ㅎ ㅗ ㅓ ㅏ ㅣ
ㅋ ㅌ ㅊ ㅍ ㅠ ㅜ ㅡ , .
```

### KO shift

- 숫자행 기호
- 된소리/Shift 자모
- 나머지 Python 동작과 동일

### EN normal

표준 QWERTY + 숫자행.

### EN shift

대문자 + Shift 기호.

기능행:

```text
Shift | 한/영 |             Space             | Del
```

별도 `Enter` key는 만들지 않는다. Python Look-Talk의 `확인`은 diff 계산만 하는 no-op placeholder였지만, 웹에서는 **`확인`을 실제 submit trigger로 정의한다.** 자세한 콜백 계약은 §15.4.

`확인` 버튼은 키보드 본체 밖/입력영역 옆의 기존 디자인을 따른다.

## 15.3 key selection source

다음이 모두 하나의 함수로 합쳐져야 한다.

```ts
selectKey(keyId)
```

호출 source:

```text
mouse click (개발/접근성 fallback)
gaze dwell
mouth confirm
future blink confirm
```

입력 방식별로 별도 키보드 컴포넌트를 만들지 않는다.

잘못된 구조:

```text
GazeKeyboard
MouthKeyboard
BlinkKeyboard
```

올바른 구조:

```text
VirtualKeyboard
      ↑
InputController
```

## 15.4 확인/제출 계약(onConfirm / onSubmit)

`VirtualKeyboard`는 채팅/메모/검색 등 "확인을 눌렀을 때 실제로 무엇을 할지"를 알지 못한다. `확인` 키가 `selectKey(keyId)`로 들어오면 문자 입력처럼 처리하지 않고, 별도 콜백을 한 번 발생시킨다.

```ts
interface VirtualKeyboardProps {
  onKeySelect?: (keyId: string) => void;   // 문자/기능키(Shift/한영/Space/Del)
  onConfirm?: () => void;                  // 확인 클릭, 인자 없음
  onSubmit?: (text: string) => void;       // 확인 클릭 시점의 composedText까지 함께 전달(둘 중 상위 페이지가 편한 쪽 사용)
}
```

- `VirtualKeyboard`/`TextComposer`는 이 콜백을 호출만 하고, 이후 동작(메시지 전송, 검색 실행, 메모 저장 등)은 전적으로 **부모 page**가 결정한다.
- **기존 `PatientHomePage.tsx`의 `handleKeySelect`가 `keyValue === 'ENTER'`일 때 `handleSend()`/병원검색을 호출하던 경로는 이 구조로 이전해야 한다** — `ENTER` 키 자체가 없어지므로, 그 자리를 대신하던 로직을 `onConfirm`/`onSubmit` 콜백으로 옮긴다. 이 마이그레이션은 Front Step 3(§23)에서 명시적으로 수행한다.
- 여러 페이지(채팅/메모/병원검색)가 각자 다른 `onConfirm`/`onSubmit` 구현을 넘기는 것을 허용한다 — `VirtualKeyboard` 자체를 페이지별로 분기하지 않는다.

---

# 16. Hangul Text Composer

현재 Front의 단순 string concat만으로는 Python Look-Talk과 동일한 한글 입력이 되지 않는다.

Python `hangul.py`의 다음 동작을 TypeScript 상태머신으로 포팅한다.

```text
초성
중성
종성
복모음
쌍자음
겹받침
종성 재분배
자모 단위 Backspace
```

`hangul-js`는 최종 assemble 보조로 사용할 수 있으나 전체 실시간 상태머신을 대체한다고 가정하지 않는다.

권장 구조:

```text
features/keyboard/composition/HangulComposer.ts
```

상태:

```ts
interface HangulComposerState {
  committedText: string;
  choseong: string | null;
  jungseong: string | null;
  jongseong: string | null;
}
```

Shift 한글 문자 입력 후 Python처럼 shift를 normal로 복귀시키는 동작을 재현한다.

---

# 17. 추천 단어 영역

현재 NLP 자동완성 기능은 구현하지 않는다.

하지만 향후 화면 레이아웃에 들어갈 수 있도록 키보드 상단에 suggestion area를 독립 컴포넌트 경계로 둘 수 있다.

예:

```text
WordSuggestionBar
```

현재 구현:

```text
hidden 또는 empty
```

금지:

- 임의 사전
- 랜덤 단어
- hard-coded 추천
- Backend InputMethodRecommendation을 단어 추천처럼 사용

향후 NLP 도입 시:

```text
WordSuggestion
```

이라는 별도 도메인/API로 연결한다.

---

# 18. UserSetting 연동

현재 Backend API:

```http
GET /api/users/me/settings
PATCH /api/users/me/settings
```

Frontend는 다음 camelCase 계약을 기준으로 실제 Backend와 재확인한다.

```ts
interface UserSettingDto {
  keyboardLayout: string;
  keyEnlarged: boolean;
  currentInputMethod: 'EYE_TRACKING' | 'BLINK' | 'MOUTH';
}
```

## 18.1 keyboardLayout

이번 버전은 QWERTY만 지원한다.

값이 QWERTY가 아니면 임의 layout을 만들지 말고 safe fallback/오류 정책을 사용한다.

## 18.2 keyEnlarged

실제 key size 렌더링에 반영한다.

## 18.3 currentInputMethod

측정 결과 모달에서 사용자가 선택한 값이 source of truth가 된다.

단:

- 선택 UI 상태만 바뀌었다고 즉시 성공 처리하지 않는다.
- PATCH 성공 후 성공 모달을 띄운다.

---

# 19. Calibration / UserSetting / Recommendation 역할 분리

세 기능을 혼동하지 않는다.

```text
Calibration
= iris를 화면 좌표로 변환하는 사용자별 매핑

UserSetting.currentInputMethod
= 현재 실제 사용할 confirm 방식

InputMethodRecommendation
= 측정 지표를 기반으로 추천하는 방식
```

예:

```text
추천: EYE_TRACKING
사용자 선택: MOUTH
실제 설정: MOUTH
```

이어야 한다.

추천 결과가 사용자 선택을 강제로 덮어쓰면 안 된다.

---

# 20. InputSession과 분석 페이지

InputSession은 프레임 전체를 서버로 보내는 기능이 아니다.

향후 Backend API가 준비되면 Front가 계산한 요약 지표만 저장한다.

예정 지표:

```text
typoRate
inputSpeed
recognitionAccuracy
inputStability
```

단, 다음은 Backend/팀 계약이 확정되기 전 Front가 임의로 정의하지 않는다.

```text
inputSpeed 단위
각 metric 공식
metric null 가능 여부
평가 시작/종료 timing
recommendation weight/threshold
```

분석 페이지의 재측정 버튼/키보드 아이콘은 동일 CalibrationSession을 재사용한다.

---

# 21. 권장 Frontend 폴더 구조

현재 빈 feature 폴더를 활용한다.

```text
src/
├─ features/
│  ├─ camera/
│  │  ├─ hooks/
│  │  │  └─ useCamera.ts
│  │  └─ types.ts
│  │
│  ├─ faceTracking/
│  │  ├─ mediapipe/
│  │  │  ├─ createFaceLandmarker.ts
│  │  │  ├─ landmarkNormalizer.ts   # §5.3 mirror 전략 A/B 적용 지점
│  │  │  └─ mirrorStrategy.ts       # Step 0 PoC 비교 후 확정된 전략 단일 소스
│  │  ├─ gaze/
│  │  │  ├─ iris.ts
│  │  │  ├─ ear.ts
│  │  │  ├─ mar.ts
│  │  │  ├─ blinkGate.ts           # §13.2 eye-closed gate (BLINK confirm과 별개)
│  │  │  └─ GazeFilter.ts          # §13.1 CSS px 경계 이후부터 동작
│  │  └─ types.ts
│  │
│  ├─ calibration/
│  │  ├─ constants.ts
│  │  ├─ calibrationPoints.ts
│  │  ├─ CalibrationSession.ts
│  │  ├─ HomographyMapper.ts
│  │  ├─ types.ts
│  │  ├─ api/
│  │  │  └─ calibrationApi.ts
│  │  └─ store/
│  │     └─ calibrationStore.ts
│  │
│  ├─ multimodalInput/
│  │  ├─ DwellController.ts
│  │  ├─ MouthClickController.ts
│  │  ├─ InputController.ts
│  │  └─ types.ts
│  │
│  ├─ keyboard/
│  │  ├─ components/
│  │  │  ├─ VirtualKeyboard.tsx
│  │  │  ├─ KeyboardKey.tsx
│  │  │  └─ WordSuggestionBar.tsx
│  │  ├─ layouts/
│  │  │  └─ qwerty.ts
│  │  ├─ composition/
│  │  │  └─ HangulComposer.ts
│  │  ├─ hooks/
│  │  ├─ api/
│  │  │  └─ userSettingApi.ts
│  │  └─ types.ts
│  │
│  └─ inputSession/
│     ├─ metrics/
│     └─ api/
│
├─ pages/
│  ├─ calibration/
│  │  └─ CalibrationPage.tsx
│  ├─ analysis/
│  │  └─ AnalysisPage.tsx
│  └─ patient/
│     └─ PatientHomePage.tsx
│
└─ shared/
   └─ stores/
      └─ inputStore.ts
```

현재 프로젝트 convention과 충돌한다면 Claude는 실제 구조를 우선하고 이유를 보고한다.

---

# 22. State 관리 원칙

## React local state

```text
camera permission
loading/error
modal open state
save in-flight state
```

## useRef / class instance

```text
raw landmarks
gaze point
Kalman state
per-frame buffers
dwell timer
mouth detector state
```

고빈도 프레임 값을 React/Zustand 전역 state로 매 프레임 밀어넣지 않는다.

## Zustand 또는 공유 Store

```text
composed text
keyboard runtime mode
selected/focused key 중 UI 공유가 필요한 값
active calibration metadata
candidate calibration workflow state
```

서버 데이터는 가능하면 API fetch 결과를 명확히 구분한다.

React Query를 새로 도입할지 여부는 현재 프로젝트 규모를 보고 결정하되, 이 기능 하나 때문에 무조건 추가하지 않는다.

---

# 23. 구현 단계

전체를 한 번에 구현하지 않는다.

## Front Step 0 — Auth/API blocker 확인 및 FaceLandmarker PoC

목표:

```text
로그인 token key 문제 확인
FaceLandmarker 실제 로드
camera → 478 landmarks
iris/EAR/MAR 실시간 확인
Mirror 전략 A(추론 전 프레임 flip) vs B(추론 후 landmark x 반전) 비교(§5.3) 및 결정
```

수정 범위:

```text
Auth token key 최소 정합 수정
camera
faceTracking/mediapipe (전략 A/B 둘 다 임시 구현해 비교)
개발용 debug page
model/WASM config
```

성공 기준:

```text
카메라 권한 정상
FaceLandmarker 로드 정상
iris landmark 468~477 존재
EAR blink 변화 확인
MAR mouth open 변화 확인
체감상 심한 프레임 드랍 없음
전략 A/B의 iris/EAR/MAR 안정성 및 FPS를 실측 비교해 하나를 채택 — 완료:
  실측 결과 유의미한 차이 없음 → 전략 A(PRE_INFERENCE_FRAME_FLIP) 확정,
  mirrorStrategy.ts DEFAULT_MIRROR_STRATEGY에 고정. A/B 토글은 debug 전용으로 유지.
```

**Step 0 완료.**

아직 키보드/Backend Calibration API를 붙이지 않는다.

## Front Step 1 — Raw 16-point Calibration

목표:

```text
iris x/y
→ 16점 sample (target = FULL VIEWPORT, §7.5.1)
→ normalized viewport Homography (rendered target == Homography destination, 변환 계층 없음)
→ window.innerWidth/innerHeight로 CSS px 변환(§7.5/§13.1 경계 지점 구현)
→ cursor (position:fixed, viewport 전체에서 이동)
측정 시작 시 full-viewport 오버레이 전환(§7.5.1) — Browser Fullscreen API는 사용하지
  않는다(§7.5.2). Interaction domain은 항상 일반 browser content viewport
calibratedViewport(widthPx/heightPx/aspectRatio/orientation)는 일반 browser 상태의
  window.innerWidth/innerHeight를 저장(§7.5.2) — 실제 Backend 저장 연동은 Step 5
```

제외:

```text
head pose
ridge
SQPnP
18 features
```

성공 기준:

```text
16점 완주 — 첫 행/마지막 행/첫 열/마지막 열 타깃이 실제 화면 상/하/좌/우 부근에 나타남
  (작은 컨테이너 안에 갇혀 있으면 실패)
화면 전체 범위에서 cursor 도달
재투영 오차 계산 가능
새로고침 전 메모리 candidate 정상 사용
normalized viewport → CSS px 변환이 오직 이 경계 한 곳에서만 일어남을 코드로 확인 가능
target 렌더링 좌표와 Homography destination 좌표가 동일한 값(CALIBRATION_GRID_POINTS)임을
  코드로 확인 가능 — 별도 로컬↔viewport 변환 계층이 없어야 한다
측정 중 Chrome 주소창/탭이 그대로 보이고, 그 아래 LookTalk 페이지 영역만 overlay가 덮음
  (Browser Fullscreen API 호출이 코드에 없어야 한다)
```

## Front Step 2 — GazeFilter + Dwell

목표:

```text
Eye-Closed Gate 구현(§13.2) — BLINK confirm(Step 9)과 무관하게 지금 구현
raw cursor 안정화(CSS px 경계 이후, §13.1)
nearest-key + assist/lock radius 히스테리시스 기반 dwell(§14.1)
  — 단순 DOMRect contains 방식으로 구현하지 않는다
1.2s dwell selection
```

임시 button grid로 먼저 검증한다.

## Front Step 3 — QWERTY + Hangul

목표:

```text
한글 normal/shift
영문 normal/shift
한/영
Shift
Space
Del
확인 → onConfirm()/onSubmit(text) 콜백 도입(§15.4)
한글 실시간 조합
PatientHomePage.tsx의 기존 ENTER 기반 handleSend/병원검색 트리거를
  onConfirm/onSubmit 콜백 구조로 이전
```

성공 기준:

```text
시선 dwell만으로 완성된 한글 문장을 입력 가능
확인 버튼 클릭 시 onConfirm/onSubmit 콜백을 통해 부모 page(PatientHomePage 등)에서
  실제 제출 동작(전송/검색)이 정상 트리거됨 — ENTER 키 없이도 기존 흐름과 동등하게 동작
```

## Front Step 4 — UserSetting API

목표:

```text
GET settings
PATCH currentInputMethod
keyEnlarged 반영
QWERTY 적용
```

이 단계까지 Backend SET-001/002만 필요하다.

## Front Step 5 — Calibration persistence API 연결

Backend V9 Calibration API 확정 후 진행.

목표:

```text
active calibration GET
candidate POST
새로고침/재로그인 재사용
저장된 calibratedViewport와 현재 viewport를 비교해
  CalibrationCompatibility(compatible/uncertain/incompatible) 판정 적용(§8.5)
uncertain/incompatible 시 재측정 권유 배너(강제 아님, 기준은 QA 후 확정)
```

## Front Step 6 — 최초 Calibration Gate + 결과 모달

목표:

```text
PATIENT login
→ active 없음
→ calibration
→ result modal
→ method selection 또는 remeasure
→ success modal
→ analysis
```

모달은 디자인대로 닫기 버튼 없음.

## Front Step 7 — Analysis 재측정

목표:

```text
analysis keyboard icon
→ same calibration session
→ candidate
→ result modal
→ apply
→ success modal
→ analysis
```

기존 active 보호를 반드시 테스트한다.

## Front Step 8 — Mouth

Python MouthClickDetector 의미를 포팅한다.

## Front Step 9 — Blink

별도 UX/알고리즘 확정 후 구현한다.

## Future — WordSuggestion NLP

이번 작업과 분리한다.

---

# 24. Backend와 병렬 진행 가능 범위

현재 Backend Emergency/Email 작업과 Front 가상키보드는 병렬 진행 가능하다.

Backend 완료를 기다리지 않고 가능한 작업:

```text
Camera
FaceLandmarker
iris/EAR/MAR
Raw Homography
GazeFilter
Dwell
QWERTY
Hangul Composer
Mouth
```

Backend 계약이 필요한 작업:

```text
Calibration persistence
InputSession 저장
InputMethodRecommendation 실제 데이터
```

이미 가능한 Backend 연동:

```text
GET /api/users/me/settings
PATCH /api/users/me/settings
```

---

# 25. Error / Fallback UX

## Camera permission denied

- 빈 키보드 화면으로 들어가지 않는다.
- 권한 필요 안내 제공.
- 브라우저 설정 안내 UX는 Front가 담당.

## FaceLandmarker load failure

- calibration 시작 금지.
- 명확한 재시도 제공.

## Active calibration GET failure

- 404 `CALIBRATION_NOT_FOUND`만 “최초 calibration 필요”로 해석.
- 401/403/5xx를 “캘리브레이션 없음”으로 오인하지 않는다.

## Active calibration viewport 비호환(§8.5)

- `uncertain`/`incompatible` 판정을 캘리브레이션이 없는 것으로 오인해 강제로 `/calibration`으로 보내지 않는다.
- 기존 값으로 계속 사용을 허용하고, 재측정 권유만 노출한다(임계값/강제 여부는 QA 후 확정).

## Calibration save failure

- result modal 유지.
- success modal 표시 금지.
- candidate 유지하여 재시도 가능.

## UserSetting PATCH failure

- success modal 표시 금지.
- calibration 저장이 이미 끝났다면 duplicate calibration POST 방지.

---

# 26. 보안 / 개인정보

브라우저에서 다음 원본/고빈도 biometric-like 데이터를 Backend에 저장하지 않는다.

```text
webcam frame
얼굴 이미지
raw face landmark frame sequence
raw iris frame sequence
EAR/MAR frame sequence 전체
```

Backend 저장 대상은 derived calibration parameter 및 요약 성능 metric으로 제한한다.

예:

```text
Homography
quality summary
viewport metadata
InputSession aggregate metrics
```

---

# 27. 테스트 전략

## Unit

```text
iris 평균 계산
mirror transform
homography solve/map
normalized coordinate 변환
GazeFilter
DwellController
MouthClickController
QWERTY state transition
HangulComposer
Backspace 자모 단위 동작
```

## Component

```text
VirtualKeyboard click fallback
hovered key 표시
dwell progress
Shift
한/영
keyEnlarged
result modal cannot close
remeasure flow
success modal navigation
```

## API integration

```text
UserSetting GET/PATCH
Calibration active GET
Calibration POST
404 vs network/server error 구분
```

## E2E

최소 시나리오:

### 신규 PATIENT

```text
signup/login
→ active calibration 없음
→ 16점 calibration
→ result modal
→ EYE_TRACKING 선택
→ calibration save
→ settings patch
→ success modal
→ 확인
→ analysis
→ keyboard 진입
→ gaze dwell input
```

### 재로그인

```text
login
→ active calibration 있음
→ calibration skip
→ 기존 설정 사용
```

### 새로고침

```text
keyboard/analysis refresh
→ active calibration reload
→ 재측정 강제 없음
```

### 재측정

```text
analysis
→ keyboard icon
→ calibration
→ remeasure
→ candidate reset
→ calibration 다시
→ MOUTH 선택
→ save
→ success
→ analysis
```

### 재측정 도중 이탈

```text
기존 active 존재
→ 재측정
→ candidate 생성
→ 페이지 이탈
→ 기존 active 유지
```

---

# 28. Claude 구현 규칙

Claude는 각 Step마다 다음 순서를 지킨다.

1. 실제 현재 파일을 먼저 읽는다.
2. 이 문서와 실제 코드가 충돌하면 실제 코드 상태를 보고한다.
3. 구현 전에 수정 파일 목록과 핵심 설계를 짧게 보고한다.
4. 정책이 이미 이 문서에 확정되어 있으면 재질문 없이 구현한다.
5. 정책이 문서에 없고 구현 결과를 바꿀 정도로 중요한 경우에만 질문한다.
6. 한 번에 다음 Step까지 넘어가지 않는다.
7. dead code나 임시 debug route를 남기지 않는다.
8. 개발용 debug component가 필요하면 명시적으로 dev-only로 격리하고 Step 종료 시 유지 필요성을 보고한다.
9. Python 코드를 줄 단위 기계 번역하지 않는다.
10. 브라우저 좌표계/React lifecycle에 맞게 재구성한다.
11. 기존 Backend API contract를 임의 변경하지 않는다.
12. Backend 미구현 API를 fake production API로 만들지 않는다.
13. 추천 단어 NLP를 임의 구현하지 않는다.
14. Blink 동작을 임의 구현하지 않는다.
15. head pose/ridge/SQPnP를 다시 범위에 넣지 않는다.
16. QWERTY 외 layout을 추가하지 않는다.
17. commit/push는 별도 요청이 있을 때만 한다.

각 Step 완료 후 최소 보고 형식:

```text
[Frontend Step N 완료 보고]

1. 구현 전 확인한 기존 코드
2. 신규/수정 파일
3. 실제 구현 구조
4. Look-Talk에서 포팅한 부분
5. 웹에 맞게 재설계한 부분
6. Backend 의존 여부
7. 테스트/수동 검증 결과
8. 남은 리스크
9. git diff --stat
10. git status --short
```

---

# 29. 구현 전 다시 확인할 Backend 계약

Frontend Step 5 이전에 `looktalk-backend` 실제 구현을 다시 읽고 다음을 확정한다.

```text
POST /api/calibrations
GET /api/calibrations/active
request/response field
CALIBRATION_NOT_FOUND code
calibrationData JsonNode schema
active replacement/revoke policy
UserSetting PATCH partial update semantics
```

Frontend 내부 타입이 Backend DTO 이름에 불필요하게 종속되지 않게 adapter를 둔다.

---

# 30. 최종 사용자 흐름

## 최초 사용

```text
회원가입
  ↓
로그인
  ↓
PATIENT
  ↓
Active Gaze Calibration 조회
  ↓
없음
  ↓
16점 Calibration
  ↓
Candidate 결과
  ↓
측정 결과 모달
  ├─ 시선 선택
  ├─ Blink 선택(구현 완료 후)
  ├─ Mouth 선택
  └─ 재측정
        ↓
        다시 Calibration

입력 방식 선택
  ↓
Calibration 저장
  ↓
UserSetting 저장
  ↓
설정 완료 모달
  ↓
확인
  ↓
분석 페이지
```

## 기존 사용자

```text
로그인 / 새로고침
  ↓
Active Calibration 있음
  ↓
재캘리브레이션 없이 재사용
  ↓
현재 InputMethod로 가상키보드 사용
```

## 재측정

```text
분석 페이지
  ↓
키보드 아이콘
  ↓
재측정
  ↓
Candidate
  ↓
결과 모달
  ├─ 재측정
  └─ 입력 방식 선택
       ↓
       새 Calibration + Setting 적용
       ↓
       완료 모달
       ↓
       확인
       ↓
       분석 페이지
```

---

# 31. 완료 정의

“가상키보드를 프론트에 붙였다”의 완료 기준은 단순히 키보드 UI가 보이는 것이 아니다.

최소 다음이 하나의 실제 사용자 흐름으로 연결되어야 한다.

```text
PATIENT 실제 로그인
→ Backend 인증된 API 호출
→ Calibration 존재 여부 확인
→ 브라우저 카메라 권한
→ FaceLandmarker
→ 16점 raw calibration
→ calibration 저장/재사용
→ 입력 방식 선택/저장
→ gaze mapping
→ smoothing
→ QWERTY hit-test
→ dwell 또는 구현 완료된 confirm 방식
→ 한글 조합
→ 실제 입력 문자열 생성
→ 분석 페이지에서 재측정 가능
```

위 흐름이 동작해야 실제 웹 통합 완료로 간주한다.
