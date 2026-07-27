const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12
const PBKDF2_ITERATIONS = 310_000
const PBKDF2_HASH = 'SHA-256'

// ── helpers ──────────────────────────────────────────────────────────────────

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(n))
  crypto.getRandomValues(bytes)
  return bytes
}

// ── Key derivation ────────────────────────────────────────────────────────────

export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key)
}

export async function importKey(rawKey: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawKey, { name: ALGORITHM, length: KEY_LENGTH }, true, [
    'encrypt',
    'decrypt',
  ])
}

// ── Encrypt / Decrypt ─────────────────────────────────────────────────────────

export interface EncryptedPayload {
  ciphertext: string // base64
  iv: string         // base64
  algorithm: string
}

export async function encryptString(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = randomBytes(IV_LENGTH)
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(plaintext),
  )
  return {
    ciphertext: bufToB64(ciphertext),
    iv: bufToB64(iv.buffer),
    algorithm: ALGORITHM,
  }
}

export async function encryptBuffer(
  data: ArrayBuffer,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = randomBytes(IV_LENGTH)
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data,
  )
  return {
    ciphertext: bufToB64(ciphertext),
    iv: bufToB64(iv.buffer),
    algorithm: ALGORITHM,
  }
}

export async function decryptString(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<string> {
  const dec = new TextDecoder()
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: b64ToBuf(payload.iv) },
    key,
    b64ToBuf(payload.ciphertext),
  )
  return dec.decode(plaintext)
}

export async function decryptBuffer(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: ALGORITHM, iv: b64ToBuf(payload.iv) },
    key,
    b64ToBuf(payload.ciphertext),
  )
}

// ── Master key wrap/unwrap ────────────────────────────────────────────────────

export interface WrappedMasterKey {
  wrapped: string   // base64 encrypted master key
  salt: string      // base64 PBKDF2 salt
  iv: string        // base64 AES-GCM iv
  algorithm: string
  kdf_iterations: number
  kdf_algorithm: string
}

export async function wrapMasterKey(
  masterKey: CryptoKey,
  password: string,
): Promise<WrappedMasterKey> {
  const salt = randomBytes(32)
  const wrapKey = await deriveKeyFromPassword(password, salt)
  const rawMaster = await exportKey(masterKey)
  const iv = randomBytes(IV_LENGTH)
  const wrapped = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, wrapKey, rawMaster)
  return {
    wrapped: bufToB64(wrapped),
    salt: bufToB64(salt.buffer),
    iv: bufToB64(iv.buffer),
    algorithm: ALGORITHM,
    kdf_iterations: PBKDF2_ITERATIONS,
    kdf_algorithm: 'PBKDF2',
  }
}

export async function unwrapMasterKey(
  data: WrappedMasterKey,
  password: string,
): Promise<CryptoKey> {
  const salt = new Uint8Array(b64ToBuf(data.salt))
  const wrapKey = await deriveKeyFromPassword(password, salt)
  const rawMaster = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: b64ToBuf(data.iv) },
    wrapKey,
    b64ToBuf(data.wrapped),
  )
  return importKey(rawMaster)
}

// ── Recovery key ─────────────────────────────────────────────────────────────

export interface RecoveryKeyBundle {
  recovery_key: string           // human-readable hex key shown to user
  encrypted_with_recovery: WrappedMasterKey
}

export async function generateRecoveryKey(masterKey: CryptoKey): Promise<RecoveryKeyBundle> {
  const rawRecovery = randomBytes(32)
  const recoveryKeyHex = Array.from(rawRecovery)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('-')
    .toUpperCase()

  const recKey = await crypto.subtle.importKey('raw', rawRecovery.buffer, { name: ALGORITHM, length: KEY_LENGTH }, false, ['encrypt'])
  const iv = randomBytes(IV_LENGTH)
  const rawMaster = await exportKey(masterKey)
  const wrapped = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, recKey, rawMaster)

  const dummy: WrappedMasterKey = {
    wrapped: bufToB64(wrapped),
    salt: bufToB64(rawRecovery.buffer), // store raw recovery key bytes as "salt" for recovery
    iv: bufToB64(iv.buffer),
    algorithm: ALGORITHM,
    kdf_iterations: 1,
    kdf_algorithm: 'NONE',
  }
  return { recovery_key: recoveryKeyHex, encrypted_with_recovery: dummy }
}

export async function recoverMasterKey(
  bundle: WrappedMasterKey,
  recoveryKeyHex: string,
): Promise<CryptoKey> {
  const clean = recoveryKeyHex.replace(/-/g, '')
  const rawRecovery = new Uint8Array(clean.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
  const recKey = await crypto.subtle.importKey('raw', rawRecovery.buffer, { name: ALGORITHM, length: KEY_LENGTH }, false, ['decrypt'])
  const rawMaster = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: b64ToBuf(bundle.iv) },
    recKey,
    b64ToBuf(bundle.wrapped),
  )
  return importKey(rawMaster)
}

// ── Content hash ──────────────────────────────────────────────────────────────

export async function hashContent(content: string): Promise<string> {
  const enc = new TextEncoder()
  const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(content))
  return bufToB64(hashBuf)
}

// ── Note encrypt/decrypt helpers ─────────────────────────────────────────────

export async function encryptNote(
  title: string,
  content: string,
  masterKey: CryptoKey,
): Promise<{ encrypted_title: EncryptedPayload; encrypted_payload: EncryptedPayload; content_hash: string }> {
  const [encrypted_title, encrypted_payload, content_hash] = await Promise.all([
    encryptString(title, masterKey),
    encryptString(content, masterKey),
    hashContent(content),
  ])
  return { encrypted_title, encrypted_payload, content_hash }
}

export async function decryptNote(
  encrypted_title: EncryptedPayload | null,
  encrypted_payload: EncryptedPayload,
  masterKey: CryptoKey,
): Promise<{ title: string; content: string }> {
  const [title, content] = await Promise.all([
    encrypted_title ? decryptString(encrypted_title, masterKey) : Promise.resolve('Untitled'),
    decryptString(encrypted_payload, masterKey),
  ])
  return { title, content }
}
