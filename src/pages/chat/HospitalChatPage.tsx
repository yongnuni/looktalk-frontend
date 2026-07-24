import { Link } from 'react-router-dom';

export default function HospitalChatPage() {
  return (
    <main className="page">
      <section className="card wide">
        <h1>병원 채팅</h1>
        <p>환자와 의료진 채팅이 들어갈 화면입니다.</p>
        <Link to="/patient">메인으로 돌아가기</Link>
      </section>
    </main>
  );
}