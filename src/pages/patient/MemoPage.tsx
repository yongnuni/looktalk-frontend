import { Link } from 'react-router-dom';

export default function MemoPage() {
  return (
    <main className="page">
      <section className="card wide">
        <h1>개인 메모장</h1>
        <p>자주 쓰는 문장과 개인 메모가 들어갈 화면입니다.</p>
        <Link to="/patient">메인으로 돌아가기</Link>
      </section>
    </main>
  );
}