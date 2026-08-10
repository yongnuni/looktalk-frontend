import { useNavigate, useSearchParams } from 'react-router-dom';
import './CalibrationPage.css';

export default function CalibrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRetestFlow =
    searchParams.get('mode') === 'retest' && searchParams.get('source') === 'analysis';

  return (
    <main className="page calibration-page">
      <section className="card wide calibration-card">
        <header className="calibration-header">
          <div>
            <p className="calibration-kicker">Look Talk</p>
            <h1>{isRetestFlow ? '입력 방식 재측정' : '캘리브레이션'}</h1>
          </div>
        </header>

        <section className="calibration-placeholder" aria-live="polite">
          {isRetestFlow ? (
            <>
              <p>입력 방식 재측정이 시작됩니다.</p>
              <p>기존 캘리브레이션 검사 기능과 연결될 예정입니다.</p>
            </>
          ) : (
            <p>기존 캘리브레이션 검사 기능과 연결될 예정입니다.</p>
          )}
        </section>

        <button
          className="calibration-back-button"
          onClick={() => navigate('/analysis')}
          type="button"
        >
          분석 페이지로 돌아가기
        </button>
      </section>
    </main>
  );
}
