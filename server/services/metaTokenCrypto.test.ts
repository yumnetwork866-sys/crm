import { afterEach, describe, expect, it, vi } from 'vitest';
import { decryptMetaToken, encryptMetaToken } from './metaTokenCrypto';

describe('Meta token encryption', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('round-trips an access token without storing plaintext', () => {
    vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', 'test-key-that-is-longer-than-thirty-two-characters');
    const token = 'EAAB-example-sensitive-token';
    const encrypted = encryptMetaToken(token);

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain(token);
    expect(decryptMetaToken(encrypted)).toBe(token);
  });

  it('rejects a missing or weak encryption key', () => {
    vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', 'too-short');
    expect(() => encryptMetaToken('token')).toThrow(/ít nhất 32 ký tự/);
  });

  it('detects ciphertext tampering', () => {
    vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', 'test-key-that-is-longer-than-thirty-two-characters');
    const encrypted = encryptMetaToken('token');
    const parts = encrypted.split(':');
    const ciphertext = Buffer.from(parts[3], 'base64url');
    ciphertext[0] ^= 1;
    parts[3] = ciphertext.toString('base64url');
    expect(() => decryptMetaToken(parts.join(':'))).toThrow();
  });
});
