const ACCESS_TOKEN_STORAGE_KEYS = ['accessToken', 'looktalk_access_token'] as const;

export function getAccessToken(): string | null {
  if (typeof localStorage === 'undefined') return null;

  for (const key of ACCESS_TOKEN_STORAGE_KEYS) {
    const token = localStorage.getItem(key)?.trim();

    if (token) return token;
  }

  return null;
}

export function clearStoredAuthTokens() {
  if (typeof localStorage === 'undefined') return;

  for (const key of ACCESS_TOKEN_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

/** 실제 로그인 흐름이 사용하는 canonical key에 새 Access Token을 저장한다. */
export function storeAccessToken(token: string) {
  if (typeof localStorage === 'undefined') return;

  localStorage.setItem('accessToken', token);
  // 개발용 legacy 토큰이 만료 토큰 대신 fallback으로 다시 선택되지 않게 정리한다.
  localStorage.removeItem('looktalk_access_token');
}

export function isJwtExpired(token: string, clockSkewSeconds = 30): boolean {
  const encodedPayload = token.split('.')[1];
  if (!encodedPayload) return false;

  try {
    const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    const payload = JSON.parse(atob(paddedPayload)) as { exp?: unknown };

    return (
      typeof payload.exp === 'number' &&
      payload.exp <= Math.floor(Date.now() / 1000) + clockSkewSeconds
    );
  } catch {
    return false;
  }
}
