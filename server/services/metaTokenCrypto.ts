import crypto from 'crypto';

const TOKEN_PREFIX = 'v1';

function getEncryptionKey(): Buffer {
  const secret = process.env.META_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('META_TOKEN_ENCRYPTION_KEY phải có ít nhất 32 ký tự.');
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptMetaToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [TOKEN_PREFIX, iv, authTag, encrypted]
    .map((part) => typeof part === 'string' ? part : part.toString('base64url'))
    .join(':');
}

export function decryptMetaToken(payload: string): string {
  const [version, ivValue, authTagValue, encryptedValue] = payload.split(':');
  if (version !== TOKEN_PREFIX || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error('Định dạng Meta access token đã mã hóa không hợp lệ.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
