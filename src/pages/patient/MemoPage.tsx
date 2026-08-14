import './MemoPage.css';

import Logo from '../../assets/Logo.png';
import SosIcon from '../../assets/sos.png';
import SettingIcon from '../../assets/setting.png';
import UpArrow from '../../assets/up_arrow.png';
import DownArrow from '../../assets/down_arrow.png';
import TrashIcon from '../../assets/trash.png';

import { Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';

import { ROUTES } from '../../shared/constants/routes';

import {
  decryptMemo,
  encryptMemo,
  generateKeyPair,
  getStoredPrivateKey,
  getStoredPublicKey,
  saveKeyPair,
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

interface E2eeKeyStatusResponse {
  registered: boolean;
  keyVersion: number | null;
  publicKey: string | null;
}

interface E2eeKeyRegisterResponse {
  keyVersion: number;
}

interface CurrentE2eeKey {
  keyVersion: number;
  publicKey: string;
}

export default function MemoPage() {
  const navigate = useNavigate();

  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [inputValue, setInputValue] = useState('');

  // =========================
  // E2EE
  // =========================
  const [currentKey, setCurrentKey] = useState<CurrentE2eeKey | null>(null);

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

    alert('로그인이 필요합니다.');

    navigate('/login');
  }, [navigate]);

  // =========================
  // E2EE Key 준비
  // =========================
  const prepareE2eeKey = useCallback(async (): Promise<CurrentE2eeKey> => {
    const headers = getAuthHeaders();

    if (!headers) {
      handleUnauthorized();

      throw new Error('Access Token이 없습니다.');
    }

    // =========================
    // 내 E2EE Key 상태 조회
    // GET /api/e2ee/keys/me
    // =========================
    const statusResponse = await fetch(`${API_BASE_URL}/api/e2ee/keys/me`, {
      method: 'GET',
      headers,
    });

    if (statusResponse.status === 401) {
      handleUnauthorized();

      throw new Error('로그인이 만료되었습니다.');
    }

    const statusResult: ApiResponse<E2eeKeyStatusResponse> =
      await statusResponse.json();

    if (!statusResponse.ok || !statusResult.success || !statusResult.data) {
      throw new Error(
        statusResult.message || 'E2EE 키 정보를 가져오지 못했습니다.',
      );
    }

    const keyStatus = statusResult.data;

    // =========================
    // 이미 공개키 등록되어 있음
    // =========================
    if (
      keyStatus.registered &&
      keyStatus.keyVersion !== null &&
      keyStatus.publicKey
    ) {
      const localPublicKey = getStoredPublicKey(keyStatus.keyVersion);

      const localPrivateKey = getStoredPrivateKey(keyStatus.keyVersion);

      // 서버에는 키가 있는데
      // 현재 브라우저에 개인키가 없는 경우
      if (!localPublicKey || !localPrivateKey) {
        throw new Error(
          '암호화 개인키가 현재 브라우저에 없습니다. ' +
            '기존 메모를 복호화할 수 없습니다.',
        );
      }

      if (localPublicKey !== keyStatus.publicKey) {
        throw new Error(
          '서버의 공개키와 현재 브라우저의 공개키가 일치하지 않습니다.',
        );
      }

      return {
        keyVersion: keyStatus.keyVersion,
        publicKey: keyStatus.publicKey,
      };
    }

    // =========================
    // 공개키 최초 등록
    // =========================
    const keyPair = await generateKeyPair();

    const registerResponse = await fetch(`${API_BASE_URL}/api/e2ee/keys`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        publicKey: keyPair.publicKey,
      }),
    });

    if (registerResponse.status === 401) {
      handleUnauthorized();

      throw new Error('로그인이 만료되었습니다.');
    }

    const registerResult: ApiResponse<E2eeKeyRegisterResponse> =
      await registerResponse.json();

    if (
      !registerResponse.ok ||
      !registerResult.success ||
      !registerResult.data
    ) {
      throw new Error(
        registerResult.message || 'E2EE 공개키 등록에 실패했습니다.',
      );
    }

    const keyVersion = registerResult.data.keyVersion;

    saveKeyPair(keyVersion, keyPair);

    return {
      keyVersion,
      publicKey: keyPair.publicKey,
    };
  }, [getAuthHeaders, handleUnauthorized]);

  // =========================
  // 메모 조회
  // GET /api/memos
  // =========================
  const loadMemos = useCallback(async () => {
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
            const text = await decryptMemo(memo.encryptedPayload);

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
  }, [getAuthHeaders, handleUnauthorized]);

  // =========================
  // 페이지 초기화
  // =========================
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');

        const key = await prepareE2eeKey();

        setCurrentKey(key);

        await loadMemos();
      } catch (error) {
        console.error('메모 페이지 초기화 실패:', error);

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
  }, [loadMemos, prepareE2eeKey]);

  // =========================
  // 메모 추가
  // POST /api/memos
  // =========================
  const handleAddMemo = async () => {
    const trimmedMemo = inputValue.trim();

    if (!trimmedMemo) {
      return;
    }

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

      setInputValue('');
    } catch (error) {
      console.error('메모 등록 실패:', error);

      setErrorMessage(
        error instanceof Error ? error.message : '메모 등록에 실패했습니다.',
      );
    } finally {
      setIsAdding(false);
    }
  };

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
  // Enter로 메모 등록
  // =========================
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isAdding) {
      void handleAddMemo();
    }
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

  return (
    <div className="memo-page">
      {/* ===========================
          Header
      =========================== */}

      <header className="memo-header">
        <div className="memo-header-left">
          <Link to="/main" className="memo-logo-link">
            <img src={Logo} alt="Look Talk" className="memo-logo" />
          </Link>

          <h1 className="memo-title">개인 메모장</h1>
        </div>

        <button type="button" className="emergency-button">
          <img src={SosIcon} alt="SOS" className="emergency-icon" />
        </button>
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
            type="button"
            className="scroll-button"
            onClick={handleScrollUp}
          >
            <img src={UpArrow} alt="위로" className="arrow-icon" />
          </button>

          <button
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
        <input
          className="memo-input"
          placeholder="메모를 입력하세요."
          value={inputValue}
          disabled={isLoading || isAdding || !currentKey}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleInputKeyDown}
        />

        <button
          type="button"
          className="keyboard-button"
          onClick={() => void handleAddMemo()}
          disabled={isLoading || isAdding || !currentKey || !inputValue.trim()}
        >
          {isAdding ? '저장 중...' : '가상 키보드로 입력하기'}
        </button>

        <Link
          to={ROUTES.MYPAGE}
          className="setting-button"
          aria-label="마이페이지"
        >
          <img src={SettingIcon} alt="설정" className="setting-icon" />
        </Link>
      </div>

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
