# 추천 결과 대시보드

## 데이터와 API 연결

- `types/recommendation.ts`: 화면용 `RecommendationDashboardData`, `MethodRecommendation`, `RecommendationMetric` 타입.
- `mock/recommendationDemo.ts`: 학술제 전용 임시 데이터. 시선 추천, 98/82/91점, 네 가지 상세 지표. 측정 계산이나 저장 API에 전달하지 않는다.
- `components/RecommendationResults.tsx`: 데이터와 재검사 콜백을 받는 표시 컴포넌트.
- `components/AnalysisDashboard.tsx`: 기존 헤더, 재검사 안내, 입력방식 저장 모달을 연결하는 컨테이너.

조회 API가 준비되면 컨테이너에서 `recommendationDemo`를 사용하는 부분을 조회 훅으로 교체한다. 응답 DTO는 별도 매퍼에서 화면용 타입으로 변환한다. `source: 'api'`, 실제 `measuredAt` 또는 `null`, `recommendedMethod`, 입력방식별 `score`와 `metrics`를 제공한다. 지표는 표시용 0~100 백분율로 변환하고 실제 단위를 백분율로 오인하지 않도록 한다. 로딩/실패/결과 없음 상태를 추가하고 실패 시 임시 데이터를 실제 결과처럼 대체하지 않는다.

현재 조회 API는 연결하지 않았다. 입력방식 변경에서 사용하는 기존 UserSetting 저장 API는 그대로 유지한다. 표시용 추천과 사용자가 선택해 저장한 입력방식은 별개다.

## 검사 완료 흐름

최초 검사와 재검사 모두 기존 측정 결과 화면을 표시한다. `상세 분석 결과 보기` 클릭 시 Calibration POST로 검사 결과를 저장한 뒤 `MeasurementResultModal` 내부 상태를 전환한다. URL은 `/calibration` 및 기존 쿼리 그대로 유지한다. UserSetting PATCH나 입력방식 자동 선택은 실행하지 않으며 검사 흐름도 REVIEW 상태로 유지한다.

`CalibrationRecommendationResults`는 캘리브레이션 전용 시선 선택만 연결하는 어댑터다. `/analysis`와 동일한 `RecommendationResults`, `recommendationDemo`, CSS를 재사용하며 대시보드 디자인과 데이터는 바꾸지 않는다. `다시 검사하기`는 기존 restart 처리로 연결한다. `입력방식 변경`은 내부 표시 상태만 바꿔 원래 측정 결과 화면으로 돌아온다. 결과 컴포넌트 자체는 유지되므로 측정 결과와 성공한 저장 ID를 잃지 않고 POST도 중복하지 않는다. 숨겨진 결과 화면의 시선 선택은 비활성화한다.

입력방식을 직접 선택하면 기존 Calibration POST → UserSetting PATCH 순서를 유지한다. 두 요청 성공 후 markComplete와 기존 resolveCalibrationCompletionPath를 사용해 최초 검사는 `/main`, 분석 페이지 재검사는 `/analysis`로 바로 이동한다. 설정 완료 화면은 이 흐름에서 렌더링하지 않으며 컴포넌트 파일은 남겨둔다. 실패하면 기존 오류/재시도 UI에 머물며 이동하지 않는다. 인증과 접근 Gate는 변경하지 않았다.

## 검증 및 남은 확인

- 전체 테스트: 53개 파일, 342개 테스트 통과. 결과 조회 시 설정 미저장, 필수 저장 대기, 저장 실패, 세 가지 입력방식 적용 테스트 포함.
- 신규 표시 컴포넌트 테스트: 3개 통과. 내부 임시 데이터 구분, 안내 문구 제거, 두 버튼 표시, 세 방식 및 지표 표시, 추천/지표 구조 변경, 날짜 누락 확인.
- TypeScript 및 Vite 프로덕션 빌드 통과. 대형 번들 경고 있음.
- 변경 파일 ESLint 및 `git diff --check` 통과.
- 표시 컴포넌트를 별도 HTML로 렌더링하여 768px/390px에서 문서 가로 넘침 없음, 버튼 높이 64px, 카드 내부 배치 및 추천 텍스트와 겹침 없음을 브라우저 DOM으로 확인. 실제 인증된 앱 전체를 대상으로 한 검증은 아니다.
- 실제 MeasurementResultModal을 사용하고 API 응답만 모의 처리한 브라우저 검증 통과: 최초/재검사에서 URL 유지, 상세 조회 시 PATCH 없음, 선택 화면 복귀와 재조회 시 POST 중복 없음, PATCH 실패/재시도, 기존 완료 목적지, POST 실패/재시도, 대시보드 재검사 콜백.
- 브라우저 검증의 완료 콜백은 실제 페이지와 동일한 resolveCalibrationCompletionPath를 사용한 테스트 콜백이다. 실제 카메라·백엔드·인증 라우트를 포함한 전체 흐름, 실제 시선 선택, 채팅/비상호출은 수동 검증이 필요하다.
