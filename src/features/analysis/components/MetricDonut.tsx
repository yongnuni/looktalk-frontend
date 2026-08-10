import type { CSSProperties } from 'react';
import type { AnalysisMetric } from '../types/analysis';

interface MetricDonutProps {
  metric: AnalysisMetric;
}

export default function MetricDonut({ metric }: MetricDonutProps) {
  return (
    <div
      aria-label={`${metric.label} ${metric.value}퍼센트`}
      className="analysis-metric-donut"
      role="img"
      style={{ '--analysis-metric-value': `${metric.value}%` } as CSSProperties}
    >
      <div className="analysis-metric-donut__center">
        <strong>{metric.value}%</strong>
      </div>
      <span className="analysis-metric-label">{metric.label}</span>
    </div>
  );
}
