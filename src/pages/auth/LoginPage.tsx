import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../shared/stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const loginAsPatient = useAuthStore((state) => state.loginAsPatient);
  const loginAsStaff = useAuthStore((state) => state.loginAsStaff);

  const handlePatientLogin = () => {
    loginAsPatient();
    navigate('/patient');
  };

  const handleStaffLogin = () => {
    loginAsStaff();
    navigate('/staff');
  };

  return (
    <main className="page">
      <section className="card">
        <h1>로그인</h1>
        <p>테스트용 로그인 화면입니다.</p>

        <div className="button-group">
          <button type="button" onClick={handlePatientLogin}>
            환자 테스트 로그인
          </button>

          <button type="button" onClick={handleStaffLogin}>
            의료진 테스트 로그인
          </button>
        </div>

        <p>
          <Link to="/signup">회원가입</Link>
        </p>
      </section>
    </main>
  );
}