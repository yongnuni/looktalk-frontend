import './MemoPage.css';

import Logo from '../../assets/Logo.png';
import SettingIcon from '../../assets/setting.png';
import UpArrow from '../../assets/up_arrow.png';
import DownArrow from '../../assets/down_arrow.png';
import TrashIcon from '../../assets/trash.png';
import TtsIcon from '../../assets/tts.png';

import { Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ROUTES } from '../../shared/constants/routes';
import { useCalibrationStore } from '../../features/calibration/store/calibrationStore';
import EmergencyButton from '../../features/emergency/components/EmergencyButton';
import { useGazeInteraction } from '../../features/gazeInteraction/GazeInteractionContext';
import { usePageScope } from '../../features/gazeInteraction/usePageScope';
import { useGazeTarget } from '../../features/gazeInteraction/useGazeTarget';
import FullViewportKeyboardOverlay from '../../features/keyboard/components/FullViewportKeyboardOverlay';
import { useKeyboardInput } from '../../features/keyboard/hooks/useKeyboardInput';
import {
  canOpenMemoKeyboard,
  isSavableMemoText,
} from '../../features/memo/memoKeyboard';
import { useUserSettings } from '../../features/userSetting/hooks/useUserSettings';
import { useUserSettingStore } from '../../features/userSetting/store/userSettingStore';
import {
  isE2eeUnauthorizedError,
  prepareCurrentUserE2eeKey,
  type PreparedE2eeKey,
} from '../../shared/api/e2eeKeys';

import {
  decryptMemo,
  encryptMemo,
  type EncryptedPayload,
} from '../../shared/utils/e2ee';

const API_BASE_URL = 'http://localhost:8080';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

interface MemoApiResponse {
  memoId: number;
  encryptedPayload: EncryptedPayload;
  createdAt: string;
  updatedAt: string;
}

interface MemoItem {
  memoId: number;
  text: string;
  encryptedPayload: EncryptedPayload;
  createdAt: string;
  updatedAt: string;
}

export default function MemoPage() {
  const navigate = useNavigate();

  // Front Step 18(회귀 수정) — MEM-01-01: [가상키보드로 입력하기] → VirtualKeyboard →
  // Confirm → 저장이 원래 제품 계약이다. 기본 scope는 MAIN이고, Keyboard가 열린 동안만
  // KEYBOARD로 전환한다(PatientChatView와 동일한 패턴, §16).
  usePageScope('MAIN');
  const { setActiveScope } = useGazeInteraction();
  const { settings } = useUserSettings();

  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // =========================
  // E2EE
  // =========================
  const [currentKey, setCurrentKey] = useState<PreparedE2eeKey | null>(null);

  // =========================
  // Loading
  // =========================
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // =========================
  // Error
  // =========================
  const [errorMessage, setErrorMessage] = useState('');

  // =========================
  // 삭제 Modal
  // =========================
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [deleteMemoId, setDeleteMemoId] = useState<number | null>(null);

  useEffect(() => {
    setActiveScope(isKeyboardOpen ? 'KEYBOARD' : 'MAIN');
  }, [isKeyboardOpen, setActiveScope]);

  // =========================
  // Access Token
  // =========================
  const getAccessToken = useCallback(() => {
    return localStorage.getItem('accessToken');
  }, []);

  // =========================
  // 인증 Header
  // =========================
  const getAuthHeaders = useCallback(() => {
    const accessToken = getAccessToken();

    if (!accessToken) {
      return null;
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
  }, [getAccessToken]);

  // =========================
  // 로그인 만료 처리
  // =========================
  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('tokenType');
    localStorage.removeItem('userRole');

    // Front Step 10 §17 — SPA 내 navigate라 모듈(zustand store) 상태는 새로고침 없이
    // 그대로 남는다. 여기서 세션을 강제 종료하면서 캐시(active뿐 아니라 candidate도)를
    // 비워두지 않으면, 다른 계정으로 다시 로그인했을 때 이전 사용자의 calibration/
    // UserSetting이 잠깐이라도 재사용될 수 있다(useAccountModals의 명시적 로그아웃과
    // 동일한 이유 — account boundary 전용 전체 초기화).
    useCalibrationStore.getState().reset();
    useUserSettingStore.getState().reset();

    alert('로그인이 필요합니다.');

    navigate('/login');
  }, [navigate]);

  // =========================
  // 메모 조회
  // GET /api/memos
  // =========================
  const loadMemos = useCallback(
    async (userId: string) => {
      const headers = getAuthHeaders();

      if (!headers) {
        handleUnauthorized();
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/memos`, {
          method: 'GET',
          headers,
        });

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        const result: ApiResponse<MemoApiResponse[]> = await response.json();

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message || '메모 조회에 실패했습니다.');
        }

        const decryptedMemos = await Promise.all(
          result.data.map(async (memo): Promise<MemoItem> => {
            try {
              const text = await decryptMemo(memo.encryptedPayload, userId);

              return {
                ...memo,
                text,
              };
            } catch (error) {
              console.error(`메모 복호화 실패 memoId=${memo.memoId}`, error);

              return {
                ...memo,
                text: '복호화할 수 없는 메모입니다.',
              };
            }
          }),
        );

        setMemos(decryptedMemos);
      } catch (error) {
        console.error('메모 조회 실패:', error);

        setErrorMessage(
          error instanceof Error ? error.message : '메모 조회에 실패했습니다.',
        );
      }
    },
    [getAuthHeaders, handleUnauthorized],
  );

  // =========================
  // 페이지 초기화
  // =========================
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');

        const key = await prepareCurrentUserE2eeKey();

        setCurrentKey(key);

        await loadMemos(key.userId);
      } catch (error) {
        console.error('메모 페이지 초기화 실패:', error);

        if (isE2eeUnauthorizedError(error)) {
          handleUnauthorized();
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : '메모 페이지를 불러오지 못했습니다.',
        );
      } finally {
        setIsLoading(false);
      }
    };

    void initialize();
  }, [handleUnauthorized, loadMemos]);

  // =========================
  // Keyboard open/close — MEM-01-01: "[가상키보드로 입력하기]"는 "입력 시작"이지
  // "작성 완료"가 아니다(§10). native inputValue 존재 여부와 무관하게, keyboard를 열
  // 수 있는 정상 상태(로딩/저장 중이 아니고 E2EE 키가 준비됨)면 항상 열 수 있어야 한다.
  // =========================
  const clearTextRef = useRef<() => void>(() => {});

  const handleOpenKeyboard = useCallback(() => {
    if (
      !canOpenMemoKeyboard({
        isLoading,
        isAdding,
        hasEncryptionKey: Boolean(currentKey),
      })
    )
      return;

    setErrorMessage('');
    setIsKeyboardOpen(true);
  }, [isLoading, isAdding, currentKey]);

  const handleKeyboardClose = () => {
    clearTextRef.current();
    setErrorMessage('');
    setIsKeyboardOpen(false);
  };

  // =========================
  // 메모 저장(VirtualKeyboard Confirm에서 호출) — Integration Plan §15.4/§19: Keyboard는
  // Memo API를 알지 못하고 onConfirm(composedText)만 호출한다. 실제 저장 경로(E2EE
  // encryptMemo + POST /api/memos)는 기존 구현을 그대로 재사용한다.
  // =========================
  const handleConfirmSave = useCallback(
    async (composedText: string) => {
      if (!isSavableMemoText(composedText)) {
        window.alert('저장할 문장이 없습니다.');
        return;
      }

      const trimmedMemo = composedText.trim();

      if (!currentKey || isAdding) {
        return;
      }

      const headers = getAuthHeaders();

      if (!headers) {
        handleUnauthorized();
        return;
      }

      try {
        setIsAdding(true);
        setErrorMessage('');

        const encryptedPayload = await encryptMemo(
          trimmedMemo,
          currentKey.publicKey,
          currentKey.keyVersion,
        );

        const response = await fetch(`${API_BASE_URL}/api/memos`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            encryptedPayload,
          }),
        });

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        const result: ApiResponse<MemoApiResponse> = await response.json();

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message || '메모 등록에 실패했습니다.');
        }

        const createdMemo: MemoItem = {
          ...result.data,
          text: trimmedMemo,
        };

        setMemos((prev) => [createdMemo, ...prev]);

        // 저장 성공 시에만 keyboard close + draft clear(§8 흐름). 실패 시에는 아래
        // catch에서 keyboard/draft를 그대로 유지한다.
        clearTextRef.current();
        setIsKeyboardOpen(false);
      } catch (error) {
        console.error('메모 등록 실패:', error);

        setErrorMessage(
          error instanceof Error ? error.message : '메모 등록에 실패했습니다.',
        );
      } finally {
        setIsAdding(false);
      }
    },
    [currentKey, isAdding, getAuthHeaders, handleUnauthorized],
  );

  const {
    keyboardState,
    text,
    handleKeySelect,
    handleSuggestionSelect,
    pendingWordBoundary,
    clearText,
  } = useKeyboardInput({ onConfirm: handleConfirmSave });

  useEffect(() => {
    clearTextRef.current = clearText;
  }, [clearText]);

  // =========================
  // TTS
  // Web Speech API를 사용하여 메모 내용을 음성으로 읽는다.
  // =========================
  const handleTtsClick = useCallback((memoText: string) => {
    const synth = (
      window as Window & {
        speechSynthesis?: SpeechSynthesis;
      }
    ).speechSynthesis;

    if (!synth) {
      window.alert('현재 브라우저에서는 음성 읽기 기능을 지원하지 않습니다.');
      return;
    }

    const trimmedText = memoText.trim();

    if (!trimmedText) {
      return;
    }

    // 기존에 읽고 있는 음성이 있다면 중지 후 새 메모를 읽는다.
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(trimmedText);

    utterance.lang = 'ko-KR';
    utterance.rate = 0.7;
    utterance.pitch = 1;
    utterance.volume = 1;

    // 사용 가능한 한국어 음성이 있으면 우선 적용
    const voices = synth.getVoices();
    const koreanVoice = voices.find((voice) =>
      voice.lang.toLowerCase().startsWith('ko'),
    );

    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    synth.speak(utterance);
  }, []);

  // 페이지를 벗어날 때 재생 중인 TTS를 정리한다.
  useEffect(() => {
    return () => {
      const synth = (
        window as Window & {
          speechSynthesis?: SpeechSynthesis;
        }
      ).speechSynthesis;

      synth?.cancel();
    };
  }, []);

  // =========================
  // 삭제 버튼 클릭
  // =========================
  const handleDeleteClick = (memoId: number) => {
    setDeleteMemoId(memoId);
    setShowDeleteModal(true);
  };

  // =========================
  // 삭제 확인
  // DELETE /api/memos/{memoId}
  // =========================
  const handleConfirmDelete = async () => {
    if (deleteMemoId === null || isDeleting) {
      return;
    }

    const headers = getAuthHeaders();

    if (!headers) {
      handleUnauthorized();
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage('');

      const response = await fetch(
        `${API_BASE_URL}/api/memos/${deleteMemoId}`,
        {
          method: 'DELETE',
          headers,
        },
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const result: ApiResponse<null> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '메모 삭제에 실패했습니다.');
      }

      setMemos((prev) => prev.filter((memo) => memo.memoId !== deleteMemoId));

      setDeleteMemoId(null);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('메모 삭제 실패:', error);

      setErrorMessage(
        error instanceof Error ? error.message : '메모 삭제에 실패했습니다.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // =========================
  // 삭제 취소
  // =========================
  const handleCancelDelete = () => {
    if (isDeleting) {
      return;
    }

    setDeleteMemoId(null);
    setShowDeleteModal(false);
  };

  // =========================
  // 위로 스크롤
  // =========================
  const handleScrollUp = () => {
    const container = document.querySelector('.memo-list') as HTMLDivElement;

    if (container) {
      container.scrollBy({
        top: -180,
        behavior: 'smooth',
      });
    }
  };

  // =========================
  // 아래로 스크롤
  // =========================
  const handleScrollDown = () => {
    const container = document.querySelector('.memo-list') as HTMLDivElement;

    if (container) {
      container.scrollBy({
        top: 180,
        behavior: 'smooth',
      });
    }
  };

  // =========================
  // Gaze targets(§28) — 실제 존재하는 핵심 navigation/action만.
  // 메모 개별 삭제는 목록 길이가 가변적이라(hooks 규칙상 목록 길이만큼 useGazeTarget을
  // .map() 안에서 호출할 수 없다, PatientChatView의 room slot과 동일한 제약) 이번
  // 범위에서는 제외한다 — 삭제는 파괴적 action이라 확인 모달까지 거쳐야 하므로 우선순위도
  // 낮다(§52).
  // =========================
  const logoTargetRef = useGazeTarget({
    id: 'memo-logo',
    scope: 'MAIN',
    onSelect: () => navigate('/main'),
  });
  // §10 — 이 target의 의미는 "작성 완료"가 아니라 "입력 시작"이다. 아직 아무 문장도
  // 입력하지 않았다는 이유로 키보드 진입 버튼이 disabled되면 안 된다.
  const addMemoTargetRef = useGazeTarget({
    id: 'memo-add',
    scope: 'MAIN',
    enabled: canOpenMemoKeyboard({
      isLoading,
      isAdding,
      hasEncryptionKey: Boolean(currentKey),
    }),
    onSelect: handleOpenKeyboard,
  });
  const settingsTargetRef = useGazeTarget({
    id: 'memo-settings',
    scope: 'MAIN',
    onSelect: () => navigate(ROUTES.MYPAGE),
  });
  const scrollUpTargetRef = useGazeTarget({
    id: 'memo-scroll-up',
    scope: 'MAIN',
    onSelect: handleScrollUp,
  });
  const scrollDownTargetRef = useGazeTarget({
    id: 'memo-scroll-down',
    scope: 'MAIN',
    onSelect: handleScrollDown,
  });

  return (
    <div className="memo-page">
      {/* ===========================
          Header
      =========================== */}

      <header className="memo-header">
        <div className="memo-header-left">
          <Link ref={logoTargetRef} to="/main" className="memo-logo-link">
            <img src={Logo} alt="Look Talk" className="memo-logo" />
          </Link>

          <h1 className="memo-title">개인 메모장</h1>
        </div>

        {/* 마이페이지와 동일한 비상호출 */}
        <EmergencyButton />
      </header>

      <div className="memo-divider"></div>

      {/* ===========================
          Memo
      =========================== */}

      <div className="memo-content">
        <div className="memo-list">
          {isLoading && (
            <div className="memo-item">
              <div className="memo-text">메모를 불러오는 중입니다.</div>
            </div>
          )}

          {!isLoading &&
            memos.map((memo) => (
              <div className="memo-item" key={memo.memoId}>
                <button
                  type="button"
                  className="delete-button"
                  onClick={() => handleDeleteClick(memo.memoId)}
                  aria-label="메모 삭제"
                >
                  <img src={TrashIcon} alt="삭제" className="trash-icon" />
                </button>

                <div className="memo-text">{memo.text}</div>

                <button
                  type="button"
                  className="tts-button"
                  onClick={() => handleTtsClick(memo.text)}
                  aria-label="메모 음성으로 듣기"
                  title="음성으로 듣기"
                >
                  <img
                    src={TtsIcon}
                    alt=""
                    className="tts-icon"
                    aria-hidden="true"
                  />
                </button>
              </div>
            ))}

          {!isLoading && memos.length === 0 && !errorMessage && (
            <div className="memo-item">
              <div className="memo-text">등록된 메모가 없습니다.</div>
            </div>
          )}
        </div>

        <div className="memo-side-buttons">
          <button
            ref={scrollUpTargetRef}
            type="button"
            className="scroll-button"
            onClick={handleScrollUp}
          >
            <img src={UpArrow} alt="위로" className="arrow-icon" />
          </button>

          <button
            ref={scrollDownTargetRef}
            type="button"
            className="scroll-button"
            onClick={handleScrollDown}
          >
            <img src={DownArrow} alt="아래로" className="arrow-icon" />
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}

      {errorMessage && <p className="memo-error-message">{errorMessage}</p>}

      {/* ===========================
          Bottom
      =========================== */}

      <div className="memo-bottom">
        <button
          ref={addMemoTargetRef}
          type="button"
          className="keyboard-button"
          onClick={handleOpenKeyboard}
          disabled={
            !canOpenMemoKeyboard({
              isLoading,
              isAdding,
              hasEncryptionKey: Boolean(currentKey),
            })
          }
        >
          {isAdding ? '저장 중...' : '가상 키보드로 입력하기'}
        </button>

        <Link
          ref={settingsTargetRef}
          to={ROUTES.MYPAGE}
          className="setting-button"
          aria-label="마이페이지"
        >
          <img src={SettingIcon} alt="설정" className="setting-icon" />
        </Link>
      </div>

      {/* ===========================
          가상 키보드 오버레이(MEM-01-01) — Chat의 patient-chat-keyboard-overlay와 동일한
          패턴. 뒤쪽 Memo UI를 완전히 덮어 Mouse/Gaze 둘 다 실수로 뒤쪽 target을 건드리지
          않는다(activeScope도 KEYBOARD로 전환됨).
      =========================== */}

      {isKeyboardOpen && (
        <FullViewportKeyboardOverlay
          ariaLabel="메모 입력"
          draftText={text}
          draftPlaceholder="문장을 입력하세요."
          errorMessage={errorMessage}
          statusMessage={isAdding ? '저장 중입니다…' : null}
          onClose={handleKeyboardClose}
          closeDisabled={isAdding}
          keyboardState={keyboardState}
          onKeySelect={handleKeySelect}
          onSuggestionSelect={handleSuggestionSelect}
          pendingWordBoundary={pendingWordBoundary}
          suggestionsEnabled
          keyEnlarged={settings?.keyEnlarged ?? false}
        />
      )}

      {/* ===========================
          삭제 확인 팝업
      =========================== */}

      {showDeleteModal && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <div className="delete-message">해당 메모를 삭제하시겠습니까?</div>

            <div className="delete-modal-buttons">
              <button
                type="button"
                className="delete-confirm-button"
                onClick={() => void handleConfirmDelete()}
                disabled={isDeleting}
              >
                {isDeleting ? '삭제 중...' : '삭제하기'}
              </button>

              <button
                type="button"
                className="delete-cancel-button"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
