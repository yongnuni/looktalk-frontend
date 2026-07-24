import { Link } from 'react-router-dom';

export default function AnalysisPage() {
  return (
    <main className="page">
      <section className="card wide">
        <h1>분석페이지</h1>
        <p>오타율, 입력 속도, 인식 정확도, 입력 안정성 분석이 들어갈 화면입니다.</p>
        <Link to="/patient">메인으로 돌아가기</Link>
      </section>
    </main>
  );
}