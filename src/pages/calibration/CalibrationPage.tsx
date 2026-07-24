import { Link } from 'react-router-dom';

export default function CalibrationPage() {
  return (
    <main className="page">
      <section className="card wide">
        <h1>캘리브레이션</h1>
        <p>gaze, blink, mouth 입력 방식 검사가 들어갈 화면입니다.</p>

        <div className="target-grid">
          {Array.from({ length: 16 }).map((_, index) => (
            <button key={index} type="button" className="target-cell">
              {index + 1}
            </button>
          ))}
        </div>

        <Link to="/patient">메인으로 돌아가기</Link>
      </section>
    </main>
  );
}