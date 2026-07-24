import { Link } from 'react-router-dom';

export default function SignupPage() {
  return (
    <main className="page">
      <section className="card">
        <h1>회원가입</h1>
        <p>나중에 이메일 인증, 비밀번호, 전화번호 인증 폼이 들어갑니다.</p>
        <Link to="/login">로그인으로 이동</Link>
      </section>
    </main>
  );
}