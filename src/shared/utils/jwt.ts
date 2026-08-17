/**
 * Front Step 14 — Backend AUTH-006(JwtTokenProvider)는 `sub` claim에 userId를 담는다.
 * Chat HOSPITAL 발송은 "나 자신에게 보내는 ciphertext"를 만들 때 현재 userId가 필요한데,
 * Frontend에는 아직 `/api/users/me`를 호출하는 곳이 없다 — 메시지 하나 보낼 때마다 그 호출을
 * 새로 추가하는 대신, 이미 갖고 있는 accessToken(JWT)의 payload를 그대로 읽는다. 서버로
 * 값을 보내는 게 아니라 이미 서명된 토큰의 평문 payload를 읽기만 하므로 서버 계약을
 * 새로 만들지 않는다.
 */
export function decodeJwtSubject(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    const payload: unknown = JSON.parse(json);

    if (payload && typeof payload === 'object' && 'sub' in payload && typeof (payload as { sub: unknown }).sub === 'string') {
      return (payload as { sub: string }).sub;
    }

    return null;
  } catch {
    return null;
  }
}

export function getCurrentUserId(): string | null {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    return null;
  }

  return decodeJwtSubject(token);
}
