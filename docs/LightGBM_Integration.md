# LightGBM 모델 연동 구조

이번 작업은 기존 캘리브레이션 추천 기능을 유지하면서, `/analysis` 페이지에 LightGBM 기반 추천 기능을 별도로 연결한 것입니다.

## 1. 모델 구성

- `src/features/recommendation/engine/`: 학습된 LightGBM 모델의 TypeScript 추론 코드(`features.ts`, `predict.ts`, `recommend.ts`, `types.ts`)
  - 별도 프로젝트 `looktalk-recommendation`의 `src/*.ts`를 그대로 복사했습니다. 피처 15개, 클래스 순서(`EYE_TRACKING`, `BLINK`, `MOUTH`), 트리 평가, softmax, 이력 가중치, 추천 규칙은 원본과 같습니다.
  - 원본과 다른 부분은 ESLint 대응 2줄뿐입니다(`recommend.ts`: `let remaining` → `const remaining`, `catch (_error)` → `catch`).
- `src/features/recommendation/models/looktalk_lgbm.json`: 학습 완료된 LightGBM 모델(약 2.6MB, 트리 600개)
- `src/features/recommendation/historyRecommendation.ts`: 백엔드 측정 이력과 모델, 대시보드를 연결하는 어댑터

## 2. 실제 데이터 처리 흐름

`AnalysisDashboard.tsx`에서 `/api/input-sessions?sessionType=CALIBRATION_TEST&size=100`으로 측정 기록을 조회합니다(`getInputSessions('CALIBRATION_TEST', 100)`).

조회된 데이터를 `historyRecommendation.ts`에서 검증·변환한 후, LightGBM 추론 엔진으로 전달합니다.

- `toMeasurementRows()`: `calibrationId`, 입력 방식, `sessionAt`(파싱 가능한 시각), `inputSpeed`(분당 음절 수, 0 초과), `typoRate`(0~1)가 유효한 `CALIBRATION_TEST` 행만 사용합니다.
- 유효한 행이 없으면 모델을 불러오지 않고 "데이터 없음" 상태가 됩니다.

모델은 최근 최대 10개 캘리브레이션 측정 그룹(`calibrationId` 기준)에 대해 예측을 수행하고, 최근 측정에 더 높은 가중치(`HISTORY_DECAY=0.5`)를 부여해 최종 추천 방식과 점수(세 방식 합 100)를 계산합니다. 최신 측정에서 빠진 방식은 추천 후보에서 제외됩니다.

계산 결과는 `toDashboardData()`에서 기존 `RecommendationDashboardData` 형식으로 변환되어 `RecommendationResults.tsx`에 표시됩니다.

- `EYE_TRACKING` → `gaze`, `BLINK` → `blink`, `MOUTH` → `mouth`
- 입력 속도 막대에 쓰는 원시 `inputSpeed`는 최신 측정 그룹의 행에서 가져옵니다.
- `RecommendationDashboardData` 타입과 `RecommendationResults.tsx`는 변경하지 않았습니다.

## 3. 화면 적용 범위

- `/analysis`: LightGBM 추천 모델 사용
- 캘리브레이션 직후 결과 화면: 기존 규칙 기반 `analysis/utils/recommend.ts` 유지
- 두 기능은 기존 `RecommendationResults` UI를 공유하지만 추천 계산 로직은 독립적으로 동작합니다. `historyRecommendation.ts`는 `analysis/utils/recommend.ts`를 import하지 않습니다.

## 4. 모델 실행 방식

- 추론 엔진 모듈(모델 JSON 포함)은 동적 import(`import('./engine/recommend')`)로 `/analysis`에서 필요할 때 로딩되며, 프로덕션 빌드에서 별도 chunk(`recommend-*.js`)로 분리됩니다.
- 백엔드는 측정 이력 저장·조회 담당
- LightGBM 추론은 프론트엔드 브라우저에서 수행
- 모델 내부 추론 오류 시 자체 규칙 기반 폴백 사용(`engine: 'rule-fallback'`)
- 모델 모듈 로딩 실패 시에는 대시보드에 오류 상태 표시
- `/analysis` 상태: `loading`, `ready`, `empty`(데이터 없음), `api-error`(조회 실패), `model-error`(모델 로딩 실패). 임시 고정 추천 데이터는 사용하지 않습니다.
- 개발 서버에서만 콘솔에 `[LookTalk:LightGBM]` 진단 로그(조회 행 수, 유효 측정 그룹 수, 엔진, 추천 방식, 방식별 점수)를 출력합니다. 프로덕션 빌드와 테스트에서는 출력되지 않습니다.

## 5. 현재 검증 결과

- `npm run build`, `npm run lint`, `npm test` 통과
- 전체 371개 테스트 통과(Python/TypeScript 예측값 동등성 14개 사례, 피처 순서·모델 스키마, 어댑터 변환, 상태 구분, 기존 캘리브레이션 추천 회귀 테스트 포함)
- 실제 브라우저 콘솔에서 `engine: "model"` 확인(개발자 로컬 환경, `[LookTalk:LightGBM]` 진단 로그)
- 실제 API 조회 결과 6행, 유효 측정 그룹 2개를 사용하여 LightGBM 추천 실행 확인(개발자 로컬 환경)
- 기존 캘리브레이션 추천 기능의 코드 변경 없음

## 6. 알려진 위험

- `MeasurementResultModal.tsx`의 InputSession 저장은 `Promise.allSettled` 결과를 확인하지 않습니다. 세 방식 중 일부 저장이 실패하면 해당 측정에서 그 방식이 빠지고, LightGBM 추천에서는 "생략된 방식"으로 처리되어 후보에서 제외됩니다(캘리브레이션 저장 로직 담당 영역).
- 캘리브레이션 직후 추천(최신 측정만, 규칙 기반)과 `/analysis` 추천(이력 가중 LightGBM)은 결과가 다를 수 있습니다.
