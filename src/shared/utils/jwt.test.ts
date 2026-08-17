import { describe, expect, it } from 'vitest';
import { decodeJwtSubject } from './jwt';

function base64UrlEncode(json: object): string {
  const utf8Bytes = encodeURIComponent(JSON.stringify(json)).replace(
    /%([0-9A-F]{2})/g,
    (_, hex: string) => String.fromCharCode(parseInt(hex, 16)),
  );
  const base64 = btoa(utf8Bytes);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fakeJwt(payload: object): string {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlEncode(payload);
  return `${header}.${body}.fake-signature`;
}

describe('decodeJwtSubject', () => {
  it('sub claim을 그대로 반환한다', () => {
    const token = fakeJwt({ sub: 'U100', role: 'PATIENT' });
    expect(decodeJwtSubject(token)).toBe('U100');
  });

  it('한글 등 non-ASCII userId도 정확히 복원한다(UTF-8 base64url 디코딩)', () => {
    const token = fakeJwt({ sub: '환자-100', role: 'PATIENT' });
    expect(decodeJwtSubject(token)).toBe('환자-100');
  });

  it('형식이 JWT가 아니면(점 2개 아님) null', () => {
    expect(decodeJwtSubject('not-a-jwt')).toBeNull();
  });

  it('payload가 JSON이 아니면 null', () => {
    expect(decodeJwtSubject('aGVhZGVy.bm90LWpzb24.sig')).toBeNull();
  });

  it('sub claim이 없으면 null', () => {
    const token = fakeJwt({ role: 'PATIENT' });
    expect(decodeJwtSubject(token)).toBeNull();
  });
});
