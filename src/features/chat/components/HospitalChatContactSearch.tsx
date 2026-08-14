import { useEffect, useRef, useState } from 'react';
import type { ChatContactDto } from '../../../shared/types/backend';
import { getChatContacts } from '../api/chatContacts';

const CONTACTS_PER_PAGE = 20;

interface HospitalChatContactSearchProps {
  keyword: string;
  page: number;
  requestId: number;
  onContactSelect: (userId: string) => Promise<void>;
  onPageChange: (page: number) => void;
}

function getContactDisplayName(contact: ChatContactDto): string {
  return contact.displayName || contact.name || contact.userId;
}

export default function HospitalChatContactSearch({
  keyword,
  page,
  requestId,
  onContactSelect,
  onPageChange,
}: HospitalChatContactSearchProps) {
  const selectingContactIdRef = useRef<string | null>(null);
  const [contacts, setContacts] = useState<ChatContactDto[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [selectingContactId, setSelectingContactId] = useState<string | null>(null);
  const [hasSelectionError, setHasSelectionError] = useState(false);
  const isSelecting = selectingContactId !== null;

  useEffect(() => {
    let isMounted = true;

    const loadContacts = async () => {
      setIsLoading(true);
      setHasError(false);
      setHasSelectionError(false);

      try {
        const data = await getChatContacts({ keyword, page, size: CONTACTS_PER_PAGE });

        if (isMounted) {
          setContacts(data.content);
          setHasNext(data.hasNext);
        }
      } catch {
        if (isMounted) {
          setContacts([]);
          setHasNext(false);
          setHasError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadContacts();

    return () => {
      isMounted = false;
    };
  }, [keyword, page, requestId]);

  const handleContactSelect = async (contact: ChatContactDto) => {
    if (selectingContactIdRef.current !== null) return;

    selectingContactIdRef.current = contact.userId;
    setSelectingContactId(contact.userId);
    setHasSelectionError(false);

    try {
      await onContactSelect(contact.userId);
    } catch {
      setHasSelectionError(true);
    } finally {
      selectingContactIdRef.current = null;
      setSelectingContactId(null);
    }
  };

  return (
    <section aria-label="병원 채팅 연락처 검색 결과">
      {isLoading ? (
        <p aria-live="polite">연락처를 불러오는 중입니다.</p>
      ) : hasError ? (
        <p role="alert">연락처를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : contacts.length > 0 ? (
        <ul aria-label="병원 채팅 연락처 검색 결과">
          {contacts.map((contact) => (
            <li key={contact.userId}>
              <button
                aria-busy={selectingContactId === contact.userId}
                disabled={isSelecting}
                onClick={() => void handleContactSelect(contact)}
                type="button"
              >
                <strong>{getContactDisplayName(contact)}</strong>
                <span> ({contact.role})</span>
                {selectingContactId === contact.userId ? <span> 채팅방을 여는 중...</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>검색 결과가 없습니다.</p>
      )}

      {hasSelectionError ? (
        <p role="alert">채팅방을 열지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : null}

      <div className="button-group">
        <button
          disabled={page === 0 || isLoading || isSelecting}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          이전
        </button>
        <button
          disabled={!hasNext || isLoading || isSelecting}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          다음
        </button>
      </div>
    </section>
  );
}
