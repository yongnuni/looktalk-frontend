import { Link } from 'react-router-dom';

export default function MyPage() {
  return (
    <main className="page">
      <section className="card wide">
        <h1>마이페이지</h1>
        <p>닉네임, 비밀번호, 전화번호 인증, 친구 목록, 재검사가 들어갈 화면입니다.</p>
        <Link to="/patient">메인으로 돌아가기</Link>
      </section>
    </main>
  );
}