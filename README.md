# Look Talk Frontend

ALS 환자 및 중증 운동장애 환자를 위한 얼굴 신호 기반 AAC 웹앱 프론트엔드입니다.  
일반 웹캠을 통해 gaze, blink, mouth 입력을 인식하고, 가상키보드·캘리브레이션·채팅·분석 화면을 제공하는 것을 목표로 합니다.

## Tech Stack

- React
- TypeScript
- Vite
- React Router
- Zustand
- Axios
- MediaPipe Tasks Vision
- hangul-js

## Getting Started

### 1. Install dependencies

```bash
npm install
````

### 2. Run dev server

```bash
npm run dev
```

### 3. Build

```bash
npm run build
```

### 4. Lint

```bash
npm run lint
```

## Environment Variables

로컬 실행 시 `.env.local` 파일을 생성합니다.

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_BASE_URL=ws://localhost:8080
```

예시 파일은 `.env.example`로 관리합니다.

## Folder Structure

```text
src/
  app/
    App.tsx
    providers.tsx
    router.tsx

  pages/
    auth/
      SplashPage.tsx
      LoginPage.tsx
      SignupPage.tsx

    patient/
      PatientHomePage.tsx
      MemoPage.tsx
      MyPage.tsx

    chat/
      HospitalChatPage.tsx
      FriendChatPage.tsx

    calibration/
      CalibrationPage.tsx

    analysis/
      AnalysisPage.tsx

    staff/
      StaffDashboardPage.tsx

  features/
    auth/
    onboarding/
    camera/
    faceTracking/
    multimodalInput/
    calibration/
    keyboard/
    inputSession/
    memo/
    chat/
    analysis/
    recommendation/
    mypage/
    emergency/
    tts/

  shared/
    api/
    components/
    constants/
    stores/
    types/
```

## Folder Rule

### `app`

앱 전체 설정을 관리합니다.

* 라우터
* Provider
* 앱 진입 컴포넌트

### `pages`

URL로 직접 접근하는 화면 단위 컴포넌트를 둡니다.

예시:

* `/login` → `pages/auth/LoginPage.tsx`
* `/patient` → `pages/patient/PatientHomePage.tsx`
* `/chat/hospital` → `pages/chat/HospitalChatPage.tsx`

### `features`

기능 단위 코드를 관리합니다.
각 기능에 필요한 컴포넌트, hook, API, util을 해당 feature 내부에 둡니다.

예시:

```text
features/keyboard/
  components/
  layouts/
  hooks/
  utils/
  types/
```

### `shared`

여러 기능에서 공통으로 사용하는 코드를 둡니다.

* `shared/api`: 공통 API 클라이언트
* `shared/components`: 공통 버튼, 레이아웃, 모달
* `shared/stores`: 전역 상태
* `shared/types`: 공통 타입
* `shared/constants`: 라우트, 상수

## Routing

| Path             | Page               | Description |
| ---------------- | ------------------ | ----------- |
| `/`              | SplashPage         | 시작 화면       |
| `/login`         | LoginPage          | 로그인         |
| `/signup`        | SignupPage         | 회원가입        |
| `/patient`       | PatientHomePage    | 환자 메인       |
| `/memo`          | MemoPage           | 개인 메모장      |
| `/chat/hospital` | HospitalChatPage   | 병원 채팅       |
| `/chat/friend`   | FriendChatPage     | 친구 채팅       |
| `/calibration`   | CalibrationPage    | 캘리브레이션      |
| `/analysis`      | AnalysisPage       | 입력 분석       |
| `/mypage`        | MyPage             | 마이페이지       |
| `/staff`         | StaffDashboardPage | 의료진 대시보드    |

## Development Rule

* 페이지 컴포넌트는 `pages`에 작성합니다.
* 기능 구현은 `features/{domain}` 내부에 작성합니다.
* 여러 기능에서 재사용되는 컴포넌트는 `shared/components`에 작성합니다.
* 공통 API 설정은 `shared/api/apiClient.ts`에서 관리합니다.
* 기능별 API 함수는 `features/{domain}/api`에 작성합니다.
* 공통 전역 상태는 `shared/stores`에 작성합니다.
* 특정 기능 내부 상태는 해당 feature의 hook에서 관리합니다.

## Current Status

현재는 프론트엔드 초기 구조 세팅 단계입니다.

구현된 항목:

* Vite React TypeScript 프로젝트 생성
* 페이지 라우팅 구조 세팅
* 기능별 폴더 구조 분리
* 공통 API 클라이언트 구조 생성
* 공통 store 구조 생성
* 가상키보드 최소 컴포넌트 구조 생성

다음 구현 예정:

* 공통 레이아웃 및 모달 고도화
* 로그인/회원가입 UI 구현
* 환자 메인 화면 구현
* 가상키보드 입력 로직 고도화
* 캘리브레이션 mock 화면 구현
* 백엔드 API 연동
