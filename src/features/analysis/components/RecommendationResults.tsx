import type { Ref } from 'react';
import Logo from '../../../assets/Logo.png';
import type { RecommendationDashboardData } from '../types/recommendation';

interface Props {
  data: RecommendationDashboardData;
  onRetest: () => void;
  retestRef: Ref<HTMLButtonElement>;
  onChangeInput: () => void;
  changeInputRef: Ref<HTMLButtonElement>;
}

export default function RecommendationResults({
  data,
  onRetest,
  retestRef,
  onChangeInput,
  changeInputRef,
}: Props) {
  const recommendation = data.methods.find(
    (method) => method.id === data.recommendedMethod,
  );

  // 실제 측정된 입력 속도 중 최댓값을 기준으로 비교한다.
  const maxInputSpeed = Math.max(
    0,
    ...data.methods
      .map((method) => method.inputSpeed)
      .filter(
        (speed): speed is number =>
          speed !== null && Number.isFinite(speed) && speed >= 0,
      ),
  );

  return (
    <section
      className="recommendation-results"
      aria-labelledby="recommendation-title"
    >
      <header className="recommendation-results__header">
        <img src={Logo} alt="Look Talk" />
        <h1 id="recommendation-title">입력 방식 추천 결과</h1>
        <span className="recommendation-results__date">
          검사 날짜: {data.measuredAt ?? '미제공'}
        </span>
      </header>

      <div className="recommendation-results__body">
        <section className="recommendation-card" aria-label="자동 추천 방식">
          <span className="recommendation-card__icon" aria-hidden="true">
            👍
          </span>

          <div>
            <p>자동 추천 방식</p>
            <strong>{recommendation?.label ?? '결과 없음'}</strong>
          </div>

          <div className="recommendation-card__actions">
            <button ref={retestRef} type="button" onClick={onRetest}>
              다시 검사하기
            </button>
            <button ref={changeInputRef} type="button" onClick={onChangeInput}>
              입력방식 변경
            </button>
          </div>
        </section>

        <div
          className="recommendation-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="입력 방식별 비교표"
        >
          <table className="recommendation-table">
            <colgroup>
              <col className="recommendation-table__label-column" />
              <col />
              <col />
              <col />
            </colgroup>

            <thead>
              <tr>
                <td aria-hidden="true" />
                {data.methods.map((method) => (
                  <th
                    key={method.id}
                    scope="col"
                    className={`recommendation-method--${method.id}`}
                  >
                    {method.label} 입력
                    <small>{method.description}</small>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr className="recommendation-table__scores">
                <th scope="row">추천 확률</th>

                {data.methods.map((method) => (
                  <td key={method.id}>
                    {method.present && method.score !== null ? (
                      <>
                        <strong
                          className={
                            method.id !== data.recommendedMethod
                              ? 'recommendation-score--amber'
                              : ''
                          }
                        >
                          {method.score}
                        </strong>
                        <span>%</span>
                      </>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                ))}
              </tr>

              <tr className="recommendation-table__details">
                <th scope="row">상세 지표</th>

                {data.methods.map((method) => {
                  const inputSpeed = method.inputSpeed;

                  const speedPercent =
                    inputSpeed !== null &&
                    Number.isFinite(inputSpeed) &&
                    inputSpeed >= 0 &&
                    maxInputSpeed > 0
                      ? Math.min(100, (inputSpeed / maxInputSpeed) * 100)
                      : 0;

                  return (
                    <td
                      key={method.id}
                      className={`recommendation-method--${method.id}`}
                    >
                      {method.present ? (
                        <div className="recommendation-metrics">
                          {/* 오타율 */}
                          <div className="recommendation-metric">
                            <span>오타율</span>

                            <div
                              role="meter"
                              aria-label={`${method.label} 오타율`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={method.typoRatePercent ?? 0}
                              className="recommendation-metric__track"
                            >
                              <span
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, method.typoRatePercent ?? 0),
                                  )}%`,
                                }}
                              />
                            </div>

                            <b>
                              {method.typoRatePercent !== null
                                ? `${method.typoRatePercent.toFixed(1)}%`
                                : '-'}
                            </b>
                          </div>

                          {/* 입력 속도 */}
                          <div className="recommendation-metric">
                            <span>입력 속도</span>

                            <div
                              role="meter"
                              aria-label={`${method.label} 입력 속도`}
                              aria-valuemin={0}
                              aria-valuemax={maxInputSpeed}
                              aria-valuenow={
                                inputSpeed !== null &&
                                Number.isFinite(inputSpeed)
                                  ? inputSpeed
                                  : 0
                              }
                              className="recommendation-metric__track"
                            >
                              <span
                                style={{
                                  width: `${speedPercent}%`,
                                }}
                              />
                            </div>

                            <b>
                              {inputSpeed !== null &&
                              Number.isFinite(inputSpeed)
                                ? inputSpeed.toFixed(1)
                                : '-'}
                            </b>
                          </div>
                        </div>
                      ) : (
                        <span>결과 없음</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
