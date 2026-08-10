import { Link } from 'react-router-dom';

import PageHeader from '../../shared/components/layout/PageHeader';
import EmergencyButton from '../../features/emergency/components/EmergencyButton';
import { usePhrases } from '../../features/phrase/hooks/usePhrases';
import { ROUTES } from '../../shared/constants/routes';

import './PhrasePage.css';

export default function PhrasePage() {
  const { phrases, maxPhrases, registerDummyPhrase, removePhrase } =
    usePhrases();

  return (
    <div className="phrase-page">
      <PageHeader
        title="자주 쓰는 문장 관리"
        logoTo={ROUTES.MAIN}
        titleActions={
          <Link to={ROUTES.MYPAGE} className="header-pill-button">
            뒤로가기
          </Link>
        }
        right={<EmergencyButton />}
      />

      <div className="phrase-toolbar">
        <button
          type="button"
          className="phrase-register-button"
          onClick={registerDummyPhrase}
        >
          문장 등록하기
        </button>

        <p className="phrase-guide">
          자주 쓰는 문장은 {maxPhrases}개까지 등록 가능합니다!
        </p>
      </div>

      <main className="phrase-list">
        {/* 등록된 문장이 없으면 공백으로 둔다 (Figma Default) */}
        {phrases.map((phrase) => (
          <div className="phrase-item" key={phrase.id}>
            <span className="phrase-text">{phrase.text}</span>

            <button
              type="button"
              className="phrase-remove-button"
              onClick={() => removePhrase(phrase.id)}
              aria-label={`${phrase.text} 삭제`}
            >
              삭제
            </button>
          </div>
        ))}
      </main>
    </div>
  );
}
