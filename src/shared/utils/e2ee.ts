import sodium from 'libsodium-wrappers';

const ALGORITHM = 'LIBSODIUM_SEALED_BOX';

const getPrivateKeyStorageKey = (userId: string, keyVersion: number) =>
  `looktalk_e2ee_private_key_${encodeURIComponent(userId)}_v${keyVersion}`;

const getPublicKeyStorageKey = (userId: string, keyVersion: number) =>
  `looktalk_e2ee_public_key_${encodeURIComponent(userId)}_v${keyVersion}`;

const getLegacyPrivateKeyStorageKey = (keyVersion: number) =>
  `looktalk_e2ee_private_key_v${keyVersion}`;

const getLegacyPublicKeyStorageKey = (keyVersion: number) =>
  `looktalk_e2ee_public_key_v${keyVersion}`;

export interface EncryptedPayload {
  algorithm: typeof ALGORITHM;
  keyVersion: number;
  ciphertext: string;
}

export interface StoredKeyPair {
  publicKey: string;
  privateKey: string;
}

// =========================
// Key Pair 생성
// =========================
export async function generateKeyPair(): Promise<StoredKeyPair> {
  await sodium.ready;

  const keyPair = sodium.crypto_box_keypair();

  const publicKey = sodium.to_base64(
    keyPair.publicKey,
    sodium.base64_variants.ORIGINAL,
  );

  const privateKey = sodium.to_base64(
    keyPair.privateKey,
    sodium.base64_variants.ORIGINAL,
  );

  return {
    publicKey,
    privateKey,
  };
}

// =========================
// Key Pair 로컬 저장
// =========================
export function saveKeyPair(userId: string, keyVersion: number, keyPair: StoredKeyPair) {
  localStorage.setItem(getPublicKeyStorageKey(userId, keyVersion), keyPair.publicKey);

  localStorage.setItem(getPrivateKeyStorageKey(userId, keyVersion), keyPair.privateKey);
}

// =========================
// 공개키 조회
// =========================
export function getStoredPublicKey(userId: string, keyVersion: number): string | null {
  return localStorage.getItem(getPublicKeyStorageKey(userId, keyVersion));
}

// =========================
// 개인키 조회
// =========================
export function getStoredPrivateKey(userId: string, keyVersion: number): string | null {
  return localStorage.getItem(getPrivateKeyStorageKey(userId, keyVersion));
}

async function isValidKeyPair(keyPair: StoredKeyPair): Promise<boolean> {
  try {
    await sodium.ready;

    const publicKey = sodium.from_base64(
      keyPair.publicKey,
      sodium.base64_variants.ORIGINAL,
    );
    const privateKey = sodium.from_base64(
      keyPair.privateKey,
      sodium.base64_variants.ORIGINAL,
    );
    const derivedPublicKey = sodium.crypto_scalarmult_base(privateKey);

    return sodium.memcmp(publicKey, derivedPublicKey);
  } catch {
    return false;
  }
}

export async function hasMatchingStoredKeyPair(
  userId: string,
  keyVersion: number,
  serverPublicKey: string,
): Promise<boolean> {
  const publicKey = getStoredPublicKey(userId, keyVersion);
  const privateKey = getStoredPrivateKey(userId, keyVersion);

  return Boolean(
    publicKey === serverPublicKey &&
      privateKey &&
      (await isValidKeyPair({ publicKey, privateKey })),
  );
}

export async function migrateLegacyKeyPair(
  userId: string,
  keyVersion: number,
  serverPublicKey: string,
): Promise<boolean> {
  if (await hasMatchingStoredKeyPair(userId, keyVersion, serverPublicKey)) {
    return true;
  }

  const legacyPublicKey = localStorage.getItem(getLegacyPublicKeyStorageKey(keyVersion));
  const legacyPrivateKey = localStorage.getItem(getLegacyPrivateKeyStorageKey(keyVersion));

  if (
    legacyPublicKey !== serverPublicKey ||
    !legacyPrivateKey ||
    !(await isValidKeyPair({ publicKey: legacyPublicKey, privateKey: legacyPrivateKey }))
  ) {
    return false;
  }

  saveKeyPair(userId, keyVersion, {
    publicKey: legacyPublicKey,
    privateKey: legacyPrivateKey,
  });
  localStorage.removeItem(getLegacyPublicKeyStorageKey(keyVersion));
  localStorage.removeItem(getLegacyPrivateKeyStorageKey(keyVersion));

  return true;
}

// =========================
// 메모 암호화
// =========================
export async function encryptMemo(
  text: string,
  publicKeyBase64: string,
  keyVersion: number,
): Promise<EncryptedPayload> {
  await sodium.ready;

  const publicKey = sodium.from_base64(
    publicKeyBase64,
    sodium.base64_variants.ORIGINAL,
  );

  const message = sodium.from_string(text);

  const ciphertext = sodium.crypto_box_seal(message, publicKey);

  const ciphertextBase64 = sodium.to_base64(
    ciphertext,
    sodium.base64_variants.ORIGINAL,
  );

  return {
    algorithm: ALGORITHM,
    keyVersion,
    ciphertext: ciphertextBase64,
  };
}

// =========================
// 메모 복호화
// =========================
export async function decryptMemo(
  payload: EncryptedPayload,
  userId: string,
): Promise<string> {
  await sodium.ready;

  const publicKeyBase64 = getStoredPublicKey(userId, payload.keyVersion);

  const privateKeyBase64 = getStoredPrivateKey(userId, payload.keyVersion);

  if (!publicKeyBase64 || !privateKeyBase64) {
    throw new Error(
      `E2EE 키를 찾을 수 없습니다. keyVersion=${payload.keyVersion}`,
    );
  }

  const publicKey = sodium.from_base64(
    publicKeyBase64,
    sodium.base64_variants.ORIGINAL,
  );

  const privateKey = sodium.from_base64(
    privateKeyBase64,
    sodium.base64_variants.ORIGINAL,
  );

  const ciphertext = sodium.from_base64(
    payload.ciphertext,
    sodium.base64_variants.ORIGINAL,
  );

  const decrypted = sodium.crypto_box_seal_open(
    ciphertext,
    publicKey,
    privateKey,
  );

  if (!decrypted) {
    throw new Error('메모 복호화에 실패했습니다.');
  }

  return sodium.to_string(decrypted);
}

export const encryptChatMessage = encryptMemo;
export const decryptChatMessage = decryptMemo;
