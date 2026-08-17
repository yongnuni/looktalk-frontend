const ACCESS_TOKEN_STORAGE_KEYS = ['accessToken', 'looktalk_access_token'] as const;

export function getAccessToken(): string | null {
  for (const key of ACCESS_TOKEN_STORAGE_KEYS) {
    const token = localStorage.getItem(key)?.trim();

    if (token) return token;
  }

  return null;
}

export function clearStoredAuthTokens() {
  for (const key of ACCESS_TOKEN_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
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
