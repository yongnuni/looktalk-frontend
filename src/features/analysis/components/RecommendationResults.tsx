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

export default function RecommendationResults({ data, onRetest, retestRef, onChangeInput, changeInputRef }: Props) {
  const recommendation = data.methods.find((method) => method.id === data.recommendedMethod);
  return (
    <section className="recommendation-results" aria-labelledby="recommendation-title">
      <header className="recommendation-results__header">
        <img src={Logo} alt="Look Talk" />
        <h1 id="recommendation-title">입력 방식 추천 결과</h1>
        <span className="recommendation-results__date">
          검사 날짜: {data.measuredAt ?? (data.source === 'demo' ? '미제공 (임시 데이터)' : '미제공')}
        </span>
      </header>
      <div className="recommendation-results__body">
        <section className="recommendation-card" aria-label="자동 추천 방식">
          <span className="recommendation-card__icon" aria-hidden="true">👍</span>
          <div>
            <p>자동 추천 방식</p>
            <strong>{recommendation?.label ?? '결과 없음'}</strong>
          </div>
          <div className="recommendation-card__actions">
            <button ref={retestRef} type="button" onClick={onRetest}>다시 검사하기</button>
            <button ref={changeInputRef} type="button" onClick={onChangeInput}>입력방식 변경</button>
          </div>
        </section>
        <div className="recommendation-table-scroll" tabIndex={0} role="region" aria-label="입력 방식별 비교표">
          <table className="recommendation-table">
            <colgroup><col className="recommendation-table__label-column" /><col /><col /><col /></colgroup>
            <thead><tr>
              <td aria-hidden="true" />
              {data.methods.map((method) => (
                <th key={method.id} scope="col" className={`recommendation-method--${method.id}`}>
                  {method.label} 입력<small>{method.description}</small>
                </th>
              ))}
            </tr></thead>
            <tbody>
              <tr className="recommendation-table__scores">
                <th scope="row">추천 점수</th>
                {data.methods.map((method) => (
                  <td key={method.id}>
                    <strong className={method.score < 90 ? 'recommendation-score--amber' : ''}>{method.score}</strong><span>점</span>
                  </td>
                ))}
              </tr>
              <tr className="recommendation-table__details">
                <th scope="row">상세 지표</th>
                {data.methods.map((method) => (
                  <td key={method.id} className={`recommendation-method--${method.id}`}>
                    <div className="recommendation-metrics">
                      {method.metrics.map((metric) => (
                        <div key={metric.id} className="recommendation-metric">
                          <span>{metric.label}</span>
                          <div role="meter" aria-label={`${method.label} ${metric.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metric.percent} className="recommendation-metric__track">
                            <span style={{ width: `${Math.min(100, Math.max(0, metric.percent))}%` }} />
                          </div>
                          <b>{metric.percent}%</b>
                        </div>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
