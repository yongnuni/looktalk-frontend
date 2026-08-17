# LookTalk Frontend Global Gaze Interaction Integration Plan v2

## 1. 문서 목적

본 문서는 LookTalk 웹 프론트엔드에서 1차로 구현된 시선 추적 기반 가상키보드를 서비스 전체 입력 체계로 확장하기 위한 2차 구현 기준을 정의한다.

1차 구현에서는 다음 파이프라인을 Web으로 포팅하였다.

```text
Camera
→ MediaPipe FaceLandmarker
→ iris / EAR / MAR
→ Calibration Homography
→ GazeFilter
→ Dwell / Mouth
→ VirtualKeyboard
→ Hangul/QWERTY
→ Confirm
```

현재 `/patient`의 가상키보드에서는 실제 얼굴 추적부터 키 선택까지 연결되어 있으며, Calibration 결과는 Backend에 저장하고 active/candidate 구조로 관리한다. UserSetting의 입력 방식과 키 크기 설정도 실제 Backend API에 연결되어 있다.

그러나 현재 시선 입력은 가상키보드 및 일부 Patient 화면 내부에 국한되어 있다.

2차 구현의 목표는 시선 입력 시스템을 특정 컴포넌트의 기능이 아니라 **PATIENT 웹서비스 전체가 공유하는 Global Interaction Runtime**으로 확장하는 것이다.

최종적으로 PATIENT 사용자는 Calibration 이후 마우스를 사용하지 않고 다음 흐름을 수행할 수 있어야 한다.

```text
로그인
→ 필요 시 Calibration
→ 메인
→ 시선으로 메뉴 이동
→ 채팅방 이동
→ 메시지 보내기 선택
→ VirtualKeyboard 표시
→ 시선/멀티모달로 문장 입력
→ 확인
→ 실제 메시지 전송
```

---

# 2. 현재 구현 상태

## 2.1 완료된 범위

다음 기능은 1차 구현 결과를 그대로 유지한다.

### Face Tracking

* MediaPipe FaceLandmarker
* 478 landmarks
* iris center
* EAR
* MAR
* Python과 동일한 mirror 기준
* `PRE_INFERENCE_FRAME_FLIP`

### Calibration

* 16-point calibration
* 4×4 grid
* browser content viewport 기준
* Homography
* Hartley normalization
* point diagnostics
* normalized viewport 좌표계
* Backend persistence
* active/candidate 이중 구조
* viewport compatibility 검사
* RMSE warning

### Gaze Pipeline

* Moving Average
* Kalman filter
* EMA
* Dead zone
* Max-step
* Fixation
* closed-eye gate

### Dwell

* nearest-key selection
* assist radius
* lock radius
* hysteresis
* 1.2초 dwell
* cooldown

### Keyboard

* QWERTY
* Korean/English
* Shift
* 한/영
* Space
* Delete
* Confirm
* Hangul composition state machine

### Mouth

* gaze target lock
* MAR 기반 입 벌림
* hold
* cooldown
* key selection

### Backend integration

* `GET /api/calibrations/active`
* Calibration POST
* UserSetting GET/PATCH
* PATIENT signup email verification
* 실제 SMTP 이메일 인증

---

# 3. 현재 남아 있는 구조적 문제

현재 시스템은 다음과 같은 구조에 가깝다.

```text
PatientHomePage
 ├ Camera
 ├ Face Tracking
 ├ useGazeInput
 ├ Gaze Cursor
 └ VirtualKeyboard
```

이 구조에서는 `/patient`에서 시선 입력이 동작하더라도 다른 페이지로 이동하면 동일한 시선 Runtime을 자연스럽게 공유하기 어렵다.

다음과 같은 구조를 만들지 않는다.

```text
PatientHomePage
→ useGazeInput()

ChatPage
→ useGazeInput()

MemoPage
→ useGazeInput()

AnalysisPage
→ useGazeInput()

VirtualKeyboard
→ useGazeInput()
```

페이지마다 카메라, FaceLandmarker, Calibration, GazeFilter를 각각 생성하는 구조는 사용하지 않는다.

최종 구조는 하나의 Global Gaze Runtime을 PATIENT 서비스 전체가 공유한다.

---

# 4. 최종 아키텍처

## 4.1 목표 구조

```text
PATIENT Application
│
└── PatientLayout
    │
    ├── GazeInteractionProvider
    │   │
    │   ├── Camera
    │   ├── FaceLandmarker
    │   ├── Iris / EAR / MAR
    │   ├── Active Calibration
    │   ├── Homography
    │   ├── GazeFilter
    │   ├── Interaction Controller
    │   ├── Target Registry
    │   └── Global Gaze State
    │
    ├── GazeCursorOverlay
    │
    └── Outlet
        ├── PatientHomePage
        ├── Chat pages
        ├── Memo pages
        ├── AnalysisPage
        ├── MyPage
        └── 기타 PATIENT 화면
```

카메라부터 gaze filtering까지의 Runtime은 PATIENT Layout 생명주기 동안 하나만 유지한다.

페이지가 변경되어도 동일한 gaze runtime을 사용한다.

---

# 5. 커서 정책

## 5.1 마우스와 Gaze Cursor를 분리한다

Web에서 시선 입력으로 운영체제의 실제 마우스 포인터를 이동시키지 않는다.

두 커서는 독립적으로 존재한다.

```text
OS / Browser Mouse Cursor
→ 실제 마우스 입력

LookTalk Gaze Cursor
→ Eye Tracking 입력
```

LookTalk Gaze Cursor는 서비스 내부에서 렌더링되는 overlay이다.

예:

```css
position: fixed;
pointer-events: none;
z-index: ...
```

를 사용한다.

---

## 5.2 Gaze Cursor는 하나만 존재한다

다음처럼 페이지별 커서를 만들지 않는다.

```text
HomeGazeCursor
ChatGazeCursor
KeyboardGazeCursor
MemoGazeCursor
```

다음 하나를 사용한다.

```text
Global GazeCursorOverlay
```

페이지와 모달이 변경되어도 동일한 cursor가 유지된다.

---

# 6. Calibration Bootstrap Gate

## 6.1 신규 사용자 판단

별도의 다음 flag를 만들지 않는다.

```text
isFirstUser
isFirstLogin
hasCompletedTutorial
```

시선 입력 사용 가능 여부는 Backend의 active calibration 존재 여부로 판단한다.

```text
GET /api/calibrations/active
```

---

## 6.2 PATIENT 로그인 후 흐름

PATIENT 인증 성공 이후 다음 흐름을 보장한다.

```text
PATIENT 로그인
        ↓
Active Calibration 조회
        ↓
┌──────────────┬──────────────┐
│ 존재          │ 없음          │
│              │              │
↓              ↓
Patient Main   Calibration
               ↓
              측정
               ↓
              저장
               ↓
             Patient Main
```

---

## 6.3 기존 사용자

Backend에 active calibration이 존재한다면 Calibration 화면을 다시 강제하지 않는다.

다음 상황에서도 동일하다.

* 새로고침
* 로그아웃 후 재로그인
* 브라우저 재접속
* Front Zustand store 초기화

클라이언트 메모리 유무가 아니라 Backend active calibration을 기준으로 판단한다.

---

## 6.4 재측정

사용자가 재측정을 수행하는 동안 기존 active calibration은 유지한다.

```text
active
→ 현재 실제 서비스 입력에 사용

candidate
→ 새로 측정 중인 결과
```

새 calibration이 정상 저장되기 전까지 active를 제거하지 않는다.

---

# 7. Global Gaze Runtime

## 7.1 역할

Global Gaze Runtime은 다음 기능을 한 곳에서 담당한다.

```text
Camera acquisition
Face tracking
Iris/EAR/MAR extraction
Calibration mapping
Gaze filtering
Cursor position
Target detection
Input mode selection
Dwell/Mouth selection
Interaction state
```

---

## 7.2 예상 Context 계약

실제 구현 시 현재 프로젝트 구조에 맞춰 이름은 변경할 수 있으나 다음 역할을 제공해야 한다.

```ts
interface GazeInteractionContext {
  cursor: {
    x: number;
    y: number;
  } | null;

  trackingValid: boolean;
  eyeClosed: boolean;

  hoveredTargetId: string | null;
  progress: number;

  inputMode: 'DWELL' | 'MOUTH';

  registerTarget(...): void;
  unregisterTarget(...): void;

  enabled: boolean;
}
```

이 문서의 interface를 그대로 복사하는 것이 목적은 아니다.

실제 기존 `useGazeInput`, `DwellController`, `MouthController`, `UserSetting` 코드를 분석한 뒤 중복 없이 리팩터링한다.

---

# 8. Gaze Target Registry

## 8.1 개념

화면상의 모든 DOM element를 gaze 대상으로 취급하지 않는다.

시선 조작을 허용할 요소만 Gaze Target으로 등록한다.

예:

```text
메인 메뉴
뒤로가기
채팅 상대
메시지 보내기
설정
Emergency
VirtualKeyboard keys
확인
```

---

## 8.2 GazeTarget 역할

Target은 최소 다음 정보를 가진다.

```text
id
DOM element
bounding rect
enabled
priority 또는 scope
selection callback
```

좌표는 현재 Web pipeline과 동일하게 **viewport CSS px**를 사용한다.

---

## 8.3 DOM 측정

Target 위치는 실제 렌더링된 DOM의:

```js
element.getBoundingClientRect()
```

를 기준으로 계산한다.

Figma 좌표나 임의의 고정 좌표를 interaction source로 사용하지 않는다.

---

# 9. Mouse와 Gaze Action 공유

동일한 UI 요소에 대해 Mouse와 Gaze가 서로 다른 비즈니스 로직을 갖지 않도록 한다.

예:

```text
Mouse click
       ┐
       ├→ openChat()
Gaze select
       ┘
```

다음 구조는 피한다.

```text
onClick → navigate()

gaze handler → 별도의 navigate 구현
```

공통 action을 사용한다.

---

# 10. Interaction Mode

현재 Web에서 실제 지원되는 selection mode는 다음 두 개이다.

```text
DWELL
MOUTH
```

Backend `currentInputMethod`의 의미와 Front Runtime mapping을 명확히 유지한다.

현재 BLINK는 production confirm 방식으로 사용하지 않는다.

---

## 10.1 DWELL

```text
Gaze Cursor
→ Target 진입
→ Target lock
→ dwell progress
→ threshold 도달
→ select
```

1차 구현에서 포팅한 DwellController를 재사용한다.

키보드 전용 로직으로 복제하지 않는다.

---

## 10.2 MOUTH

```text
Gaze Cursor
→ Target lock
→ 입 벌림
→ MAR hold
→ select
```

1차 구현의 MouthController를 재사용한다.

Mouth는 keyboard만 선택하는 기능이 아니라 일반 GazeTarget 선택에도 사용할 수 있도록 확장한다.

---

## 10.3 BLINK

BlinkDetector는 현재 closed-eye gate에는 사용하지만 key confirm input으로는 사용하지 않는다.

Python Look-Talk에서도 BlinkEvent가 실제 selection에 소비되지 않았으므로 임의의 UX나 threshold를 만들지 않는다.

향후 별도 product contract가 확정된 뒤 구현한다.

---

# 11. Interaction Scope

전체 서비스에서 동시에 모든 target을 활성화하지 않는다.

현재 UX 상태에 따라 interaction scope를 분리한다.

예:

```text
MAIN
CHAT
KEYBOARD
MODAL
CALIBRATION
```

---

## 11.1 일반 화면

예:

```text
scope = CHAT
```

이면 현재 Chat page의 target만 선택 가능하다.

---

## 11.2 Keyboard 표시 중

VirtualKeyboard가 표시된 동안에는:

```text
scope = KEYBOARD
```

로 전환한다.

채팅 화면 뒤쪽의:

* 메시지
* 설정
* 뒤로가기
* 다른 버튼

등이 실수로 선택되지 않도록 한다.

---

## 11.3 Modal

중요한 modal이 활성화된 경우:

```text
scope = MODAL
```

로 전환하고 modal 내부 action만 시선으로 선택 가능하게 한다.

---

# 12. Patient Main 전역 Eye Tracking

Calibration 완료 후 Patient Main에 진입하면 Global Gaze Runtime을 사용할 수 있어야 한다.

LookTalk Gaze Cursor가 화면 전체에서 움직여야 한다.

최소 다음 주요 navigation부터 GazeTarget으로 적용한다.

```text
병원 채팅
친구 채팅
메모
분석
마이페이지
Emergency 관련 action
```

실제 현재 화면에 존재하는 메뉴와 컴포넌트를 먼저 조사한 후 적용한다.

존재하지 않는 UI를 문서만 보고 새로 만들지 않는다.

---

# 13. Chat 화면 Eye Tracking

Chat 관련 화면에서도 Global Gaze Runtime을 그대로 사용한다.

페이지마다 새로운 FaceLandmarker 또는 useGazeInput 인스턴스를 생성하지 않는다.

---

## 13.1 Chat list

다음 요소를 시선으로 선택 가능하게 한다.

* 대화 상대
* 병원 채팅 검색
* 친구 채팅 이동
* 요청
* 이전/다음
* 실제 UI에 존재하는 navigation 요소

---

## 13.2 Chat Room

채팅방에서는 최소 다음 요소를 gaze target으로 만든다.

```text
메시지 보내기
뒤로가기
실제 필요한 채팅 action
```

---

# 14. Chat → VirtualKeyboard UX

채팅 화면의 하단 `메시지 보내기` 버튼/영역을 선택하면 VirtualKeyboard를 표시한다.

선택 방법은 Mouse 또는 현재 multimodal input 모두 가능하다.

```text
CHAT
↓
메시지 보내기 선택
↓
KEYBOARD scope
↓
VirtualKeyboard 표시
```

---

# 15. VirtualKeyboard 표시 방식

현재 구현된 QWERTY/Hangul VirtualKeyboard를 재사용한다.

채팅 전용 별도 키보드를 만들지 않는다.

키보드 화면은 기존 Python Look-Talk의 입력 화면과 동일한 개념을 유지한다.

```text
┌───────────────────────────────────┐
│ 작성 문장                     확인 │
├───────────────────────────────────┤
│                                   │
│ 1 2 3 4 5 6 7 8 9 0               │
│ ㅂ ㅈ ㄷ ㄱ ...                     │
│ ㅁ ㄴ ㅇ ...                        │
│ ㅋ ㅌ ㅊ ...                        │
│                                   │
│ Shift | 한/영 | Space | Delete     │
└───────────────────────────────────┘
```

키 크기와 세부 CSS는 Web 반응형 구조에 맞춘다.

Python desktop UI의 pixel layout을 그대로 복사하지 않는다.

키 배열과 기능 의미는 Python 원본을 기준으로 한다.

---

# 16. Chat Keyboard Confirm 의미

채팅에서는 VirtualKeyboard의 `확인`이 **메시지 전송**을 의미한다.

다음 UX를 사용하지 않는다.

```text
키보드 확인
→ 키보드 닫음
→ 채팅의 전송 버튼 다시 선택
→ 전송
```

최종 UX는 다음이다.

```text
메시지 보내기
↓
VirtualKeyboard
↓
문장 작성
↓
확인
↓
실제 Chat message 전송
↓
성공
↓
VirtualKeyboard 닫기
↓
채팅방 복귀
```

---

## 16.1 onConfirm 재사용

현재 VirtualKeyboard의:

```text
onConfirm(composedText)
```

계약을 유지한다.

VirtualKeyboard 자체는 `확인` 이후 무슨 비즈니스 동작을 하는지 알지 않는다.

호출 페이지가 의미를 결정한다.

예:

```text
Chat
onConfirm
→ 메시지 전송

Hospital search
onConfirm
→ 검색

Memo
onConfirm
→ 메모 저장
```

---

# 17. 실제 Chat 전송 연결

VirtualKeyboard confirm 시 실제 현재 Chat 전송 경로를 사용한다.

Claude는 구현 전에 실제 Front/Backend 코드를 확인한다.

다음을 직접 조사한다.

```text
ChatRoom component
Chat API
WebSocket client
message send 함수
room state
optimistic rendering 여부
CHAT API DTO
```

이미 존재하는 message send 함수를 재사용한다.

문서만 보고 새로운 `/api/chat/messages` 같은 endpoint를 임의로 만들지 않는다.

---

## 17.1 성공

```text
VirtualKeyboard confirm
→ existing send message action
→ 성공
→ text clear
→ keyboard close
→ CHAT scope
```

---

## 17.2 실패

메시지 전송에 실패했다면 입력한 문장을 즉시 삭제하지 않는다.

```text
send fail
→ keyboard/text 상태 보존
→ 오류 안내
→ 재시도 가능
```

---

# 18. Keyboard와 Global Gaze Runtime 통합

현재 Keyboard가 자체 `useGazeInput()`을 직접 소유하고 있다면 Global Runtime으로 통합한다.

최종 구조는:

```text
Global Gaze Runtime
       ↓
cursor
       ↓
Target Registry
       ↓
KEYBOARD scope
       ↓
Keyboard Key Targets
```

이다.

다음 구조를 사용하지 않는다.

```text
Global gaze
+
VirtualKeyboard local gaze
```

FaceLandmarker, Camera, GazeFilter가 동시에 두 개 실행되지 않도록 한다.

---

# 19. Keyboard Target

VirtualKeyboard의 모든 선택 가능한 key는 GazeTarget이다.

예:

```text
숫자
한글 자모
영문
Shift
한/영
Space
Delete
Confirm
```

기존 `data-key-id` 또는 DOM target 수집 구현을 Global Target Registry와 최대한 재사용한다.

불필요한 전체 재작성을 하지 않는다.

---

# 20. Global Camera Lifecycle

카메라는 PATIENT 서비스 안에서 페이지를 이동할 때 매번 끊었다가 다시 열지 않는 것을 우선한다.

단 다음 상황에서는 중지한다.

```text
logout
PATIENT 영역 이탈
camera permission revoke
필요한 fatal tracking error
```

브라우저 정책상 사용자 gesture가 필요한 초기 camera start는 현재 구현과 호환되게 처리한다.

---

# 21. Tracking Failure

얼굴이 검출되지 않거나 tracking confidence가 유효하지 않은 경우:

```text
Gaze Cursor selection 중단
Dwell reset
Mouth reset
Target confirm 금지
```

마지막 gaze cursor 위치를 시각적으로 유지하는 것은 가능하나 selection progress가 계속 진행되면 안 된다.

---

# 22. Closed Eye Gate

눈이 감힌 상태에서는 기존 GazeFilter 정책을 유지한다.

```text
eye closed
→ gaze invalid
→ selection progress reset/중지
```

의도치 않은 key/action 선택을 막는다.

---

# 23. Viewport 변경

active calibration이 존재하더라도 viewport compatibility 상태를 확인한다.

화면 크기, 방향, aspect ratio가 Calibration 당시와 크게 달라졌다면 재측정을 권장한다.

현재 도입된 compatibility 정책을 유지한다.

무조건 Calibration으로 강제 이동시키지는 않는다.

---

# 24. Calibration 정확도 Known Issue

현재 Web RAW Homography calibration은 구조적으로 구현되었으나 실제 사용자 Webcam 테스트에서 높은 RMSE가 관찰된 이력이 있다.

실측 예:

```text
reprojectionRmseNormalized ≈ 0.1853
```

이 값은 정상 synthetic 테스트보다 크게 높았다.

따라서 Global Gaze 적용이 완료되었다고 해서 Calibration 정확도 문제가 해결된 것으로 간주하지 않는다.

현재 `0.05` RMSE 기준은 production hard gate가 아니라 **QA용 provisional warning threshold**이다.

---

## 24.1 2차 구현 이후 다시 수행할 Calibration QA

Global Runtime과 Chat E2E가 연결된 뒤 실제 Webcam에서 다시 측정한다.

확인 항목:

```text
16점 calibration RMSE
화면 4개 corner 접근성
중앙 정확도
키보드 각 row 접근성
메인 navigation target 선택
Chat message button 선택
```

---

## 24.2 Calibration 개선

실제 QA에서 Raw Homography로 서비스 사용이 어려울 정도의 오차가 지속되면 그때 Calibration mapping 자체를 별도 개선한다.

Global Runtime 구현과 Calibration 모델 연구를 동시에 뒤섞지 않는다.

---

# 25. Mouth Known Limitation

현재 Mouth selection은 Python `MouthClickDetector`의 주요 runtime 동작을 포팅하였다.

다만 Python의 개인별 MAR calibration harness는 Web에 포팅하지 않았다.

따라서 2차 E2E에서 다음을 검증한다.

```text
사용자별 MAR 차이
거리 변화
입 벌림 false positive
입 벌림 false negative
```

실사용 문제가 확인된 경우 별도의 Web용 Mouth calibration UX를 설계한다.

---

# 26. Blink

Blink confirm은 2차 구현 blocker가 아니다.

현재 상태:

```text
BlinkDetector
→ closed-eye detection 사용

BlinkEvent
→ production selection에는 사용하지 않음
```

그대로 유지한다.

Blink confirm UX가 확정되기 전까지 `currentInputMethod=BLINK`를 실제 production selection에 연결하지 않는다.

---

# 27. Patient 전체 화면 확대 적용

Global Gaze Runtime이 안정적으로 동작한 후 시선 target을 순차적으로 확장한다.

우선순위는 다음과 같다.

### Priority 1

```text
Patient Main
Chat navigation
Chat Room
VirtualKeyboard
```

### Priority 2

```text
Memo
Phrase
Analysis
MyPage
```

### Priority 3

```text
설정
기타 보조 UI
```

모든 화면을 한 번에 수정하지 않는다.

---

# 28. Emergency

Emergency action은 일반 dwell target으로 둘 수 있으나 오작동 위험을 고려해야 한다.

실제 현재 UI와 제품 정책을 먼저 확인한다.

단순히 시선이 일정 시간 머물렀다는 이유만으로 즉시 응급 요청을 발송하는 UX는 별도 검토 없이 만들지 않는다.

필요한 경우:

```text
Emergency target select
→ confirm modal
→ confirm
→ Emergency API
```

와 같은 2단계를 사용한다.

---

# 29. Accessibility / Mouse Fallback

Gaze 기능을 추가해도 기존 Mouse 조작을 제거하지 않는다.

모든 주요 기능은 최소:

```text
Mouse
Gaze
```

두 방식으로 사용할 수 있어야 한다.

멀티모달 선택 방식은 UserSetting에 따라 추가된다.

---

# 30. 개발용 상태 표시

개발 단계에서는 다음 정보를 확인할 수 있는 debug 정보가 필요할 수 있다.

```text
trackingValid
cursor x/y
active target
input mode
dwell progress
MAR
active calibration id
compatibility
```

Production 기본 화면에는 연구용 수치나 debug UI를 무조건 노출하지 않는다.

필요하면 dev route 또는 dev flag에서만 표시한다.

---

# 31. 구현 단계

1차 문서의 Step 0~9 이후 번호를 이어서 사용한다.

---

## Front Step 10 — Calibration Bootstrap Gate

### 목표

PATIENT 로그인/진입 시 active calibration 존재 여부로 초기 이동 경로를 결정한다.

### 구현

```text
PATIENT authenticated
→ load active calibration
→ found → patient
→ 404/not found → calibration
```

### 완료 기준

신규 PATIENT는 메인보다 Calibration을 먼저 수행한다.

기존 PATIENT는 메인으로 바로 진입한다.

---

# 32. Front Step 11 — Global Gaze Runtime

### 목표

`PatientHomePage`에 국한된 gaze lifecycle을 Patient Layout 수준으로 승격한다.

### 구현

* GazeInteractionProvider
* Camera lifecycle
* FaceTracking
* Active Calibration
* GazeFilter
* DwellController
* MouthController
* global state

### 완료 기준

PATIENT 영역에서 route가 변경되어도 동일한 gaze runtime이 유지된다.

---

# 33. Front Step 12 — Global Gaze Cursor + Target Registry

### 목표

서비스 전체에서 하나의 LookTalk gaze cursor를 사용한다.

### 구현

* GazeCursorOverlay
* Target registration
* Target unregister
* DOM rect 측정
* current target
* progress
* scope

### 완료 기준

메인 화면의 주요 버튼을 시선으로 선택할 수 있다.

---

# 34. Front Step 13 — Patient Navigation Gaze Integration

### 목표

메인에서 핵심 서비스 화면까지 Mouse 없이 이동할 수 있게 한다.

최소:

```text
Main
→ Chat
→ Chat Room
```

### 완료 기준

Calibration 이후 Mouse 없이 채팅방에 진입한다.

---

# 35. Front Step 14 — Chat VirtualKeyboard Integration

### 목표

채팅의 `메시지 보내기`를 선택하면 VirtualKeyboard를 표시한다.

### 흐름

```text
Chat
→ 메시지 보내기
→ Keyboard open
→ KEYBOARD scope
→ 문장 입력
→ Confirm
→ 실제 메시지 전송
→ Keyboard close
```

### 완료 기준

VirtualKeyboard의 Confirm 한 번으로 실제 채팅 전송까지 완료한다.

---

# 36. Front Step 15 — Service-wide Gaze Target Expansion

### 목표

다른 PATIENT 화면까지 Global Gaze Target을 확장한다.

대상:

```text
Memo
Phrase
Analysis
MyPage
기타 실제 PATIENT 기능
```

각 화면의 기존 Mouse click action을 재사용한다.

---

# 37. Front Step 16 — Full E2E / QA

최종 E2E는 다음 흐름을 기준으로 한다.

```text
PATIENT 회원가입
↓
로그인
↓
active calibration 없음
↓
Calibration
↓
입력 방식 선택
↓
Calibration 저장
↓
Main
↓
Global Gaze Cursor
↓
시선으로 Chat 선택
↓
시선으로 상대 선택
↓
Chat Room
↓
시선으로 메시지 보내기
↓
VirtualKeyboard
↓
"감사합니다" 입력
↓
시선으로 확인
↓
실제 메시지 전송
↓
Chat Room 복귀
```

Calibration 완료 이후 이 흐름을 **Mouse를 사용하지 않고 수행할 수 있어야 한다.**

---

# 38. 자동 테스트

기존 Vitest 테스트를 유지한다.

추가로 가능한 pure logic은 unit test를 작성한다.

필수 후보:

```text
Target registration/unregistration
Scope change
Disabled target 제외
Target selection
Dwell selection
Mouth selection
Tracking invalid reset
Keyboard scope 전환
Chat confirm callback
Calibration gate decision
```

DOM integration은 필요 시 React testing 환경을 검토하되 테스트 도입을 위해 과도한 인프라를 추가하지 않는다.

---

# 39. 수동 Browser QA

자동 테스트와 별개로 실제 webcam E2E가 필수이다.

확인 항목:

```text
신규 사용자 Calibration Gate
기존 사용자 Calibration skip
Global cursor
route 변경 후 cursor 지속
Main gaze navigation
Chat gaze navigation
Keyboard open
Korean typing
Space
Delete
Shift
한/영
Confirm → Chat send
Mouth selection
Mouse fallback
refresh
logout/login
viewport 변경
```

---

# 40. 성능 확인

Global Runtime 전환 이후 다음을 확인한다.

```text
FaceLandmarker instance 수
Camera MediaStream 수
requestAnimationFrame loop 수
이벤트 listener 중복
Target registry 누수
route 전환 후 cleanup
```

한 화면에서 FaceLandmarker나 Camera가 두 번 실행되면 안 된다.

---

# 41. 기존 코드 보호 원칙

2차 구현에서 다음 코드를 다시 처음부터 작성하지 않는다.

```text
Calibration
Homography
GazeFilter
Kalman
DwellController
MouthController
HangulComposer
KeyboardStateMachine
QWERTY layouts
VirtualKeyboard
UserSetting API
Calibration API
```

필요한 작업은 **재사용 및 구조 승격**이다.

---

# 42. Python Look-Talk Source of Truth

알고리즘 동작을 수정해야 할 경우 문서 설명만 보고 추측하지 않는다.

실제 `Look-Talk` Python 코드를 다시 확인한다.

특히:

```text
main.py
tracking/gaze_pipeline.py
tracking/dwell.py
tracking/mouth.py
tracking/blink.py
keyboard.py
hangul.py
calibration.py
```

실제 파일명이 다르면 repository에서 대응 구현을 찾는다.

---

# 43. Web Intentional Differences

다음은 Python Desktop과 Web의 의도적인 차이이다.

### 허용

```text
Python desktop cursor
→ Web overlay Gaze Cursor

Python button geometry
→ DOM getBoundingClientRect()

Desktop window
→ browser content viewport

Python UI loop
→ React/global runtime

Python confirm callback
→ page/business action

Python keyboard screen
→ Web overlay/full-page input UI
```

이를 parity bug로 분류하지 않는다.

---

# 44. 여전히 제외되는 항목

다음은 별도 결정 전까지 이번 2차 구현 범위에서 제외한다.

```text
Head-pose corrected gaze
SQPnP mapping
Ridge hybrid mapping
18D feature mapping
L2CS
Python research CSV logging
desktop debug controls
Cheonjiin
실제 WordSuggestion NLP
새로운 Blink confirm 알고리즘
```

단 실제 Calibration accuracy 문제 해결을 위해 추후 별도 phase에서 재검토할 수 있다.

---

# 45. 구현 전 반드시 조사할 항목

Claude는 각 Step 구현 전에 실제 Front 코드를 조사한다.

특히 다음을 확인한다.

```text
PATIENT router/layout 구조
login 이후 navigate 구조
auth store
active calibration hook
PatientHomePage
Chat pages
Chat room
Chat WebSocket/API
message send action
VirtualKeyboard
useGazeInput
DwellController
MouthController
UserSetting
currentInputMethod
```

존재하는 구조를 재사용한다.

문서에 적힌 예시 component 이름이 실제 프로젝트와 다르면 실제 코드가 우선한다.

---

# 46. Source Priority

충돌 시 다음 우선순위를 사용한다.

### 1순위

`LookTalk_Frontend_Global_Gaze_Interaction_Integration_Plan_v2.md`

현재 제품 전체 interaction contract를 정의한다.

### 2순위

1차 문서:

`LookTalk_Frontend_VirtualKeyboard_Integration_Plan.md`

Calibration 및 가상키보드 Web port contract를 정의한다.

### 3순위

실제 `Look-Talk` Python source.

알고리즘의 source of truth이다.

### 4순위

현재 `looktalk-frontend`.

현재 Web UI/라우팅/API integration 구조의 source of truth이다.

### 5순위

실제 `looktalk-backend`.

API endpoint, DTO, 권한, WebSocket 계약의 source of truth이다.

---

# 47. 금지사항

다음을 하지 않는다.

```text
OS mouse cursor를 gaze로 이동
페이지마다 Camera 새로 생성
페이지마다 FaceLandmarker 새로 생성
페이지마다 별도의 GazeFilter 생성
채팅용 VirtualKeyboard 별도 복제
메인용/채팅용/키보드용 gaze cursor 각각 생성
Backend에 존재하지 않는 API 생성
Blink UX 임의 발명
기존 Calibration/Keyboard 알고리즘 전면 재작성
active calibration 대신 candidate를 실제 입력에 사용
Gaze 기능 때문에 Mouse 조작 제거
```

---

# 48. Git 정책

각 구현 단계에서:

```text
npm run build
npm run lint
npm test
```

를 수행한다.

기존 테스트가 깨지지 않아야 한다.

현재 working tree에 다른 미커밋 작업이 있으면 임의로 삭제하거나 revert하지 않는다.

금지:

```text
git reset --hard
git clean -fd
```

Commit/Push는 사용자가 요청할 때만 수행한다.

---

# 49. 완료 판정

2차 구현 완료는 단순히 다음 상태를 의미하지 않는다.

```text
Gaze cursor가 화면에 보인다.
```

또는:

```text
VirtualKeyboard key 하나가 gaze로 눌린다.
```

완료 기준은 실제 서비스 flow이다.

## 최소 완료 기준

```text
Calibration 이후
↓
Mouse 사용 없이
↓
Main
↓
Chat
↓
Chat Room
↓
메시지 보내기
↓
VirtualKeyboard
↓
문장 입력
↓
Confirm
↓
실제 메시지 전송
```

이 전체 흐름이 실제 Browser + Webcam + Backend 환경에서 성공해야 한다.

---

# 50. 2차 구현 완료 후 남을 수 있는 후속 과제

2차 구현 완료 후에도 다음 과제는 별도로 남을 수 있다.

### Calibration Accuracy

실기기 데이터를 기반으로 mapping 방식 개선.

### Mouth Personalization

사용자별 MAR threshold calibration.

### Blink Confirm

제품 UX/gesture contract 정의 후 구현.

### Word Suggestion

실제 추천 모델/API 연결.

### Fine-grained Gaze UX

* dwell duration 개인화
* target assist radius
* large target mode
* gaze accessibility tuning
* accidental activation 방지

이 항목들은 Global Gaze Interaction 구조를 먼저 완성한 뒤 진행한다.

---

## 최종 구조 요약

```text
                     ┌─────────────────────┐
                     │ Active Calibration  │
                     └──────────┬──────────┘
                                │
Camera
  │
  ▼
FaceLandmarker
  │
  ▼
Iris / EAR / MAR
  │
  ▼
Homography
  │
  ▼
GazeFilter
  │
  ▼
Global LookTalk Gaze Cursor
  │
  ▼
Gaze Target Registry
  │
  ├───────────────┬─────────────────┐
  ▼               ▼                 ▼
Main Targets    Chat Targets    Keyboard Targets
  │               │                 │
  └───────────────┴────────┬────────┘
                           ▼
                   Selection Controller
                    ├─ Dwell
                    └─ Mouth
                           │
                           ▼
                       Action
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           Navigate      Open KB     Send Message
```
