import { Link } from 'react-router-dom';

export default function SplashPage() {
  return (
    <main className="page">
      <section className="card">
        <h1>Look Talk</h1>
        <p>얼굴 신호 기반 AAC 커뮤니케이션 시스템</p>
        <Link to="/login">시작하기</Link>
      </section>
    </main>
  );
}