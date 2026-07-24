import { Link } from 'react-router-dom';

export default function StaffDashboardPage() {
  return (
    <main className="page">
      <section className="card wide">
        <h1>의료진 대시보드</h1>
        <p>담당 환자 목록, 채팅, 비상 호출 확인 화면입니다.</p>
        <Link to="/login">로그인으로 돌아가기</Link>
      </section>
    </main>
  );
}