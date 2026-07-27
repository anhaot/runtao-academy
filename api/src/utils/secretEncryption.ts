import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1';

function decodeEncryptionKey(raw: string | undefined): Buffer | null {
  const value = raw?.trim();
  if (!value) return null;

  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error('AI_CONFIG_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64).');
  }
  return key;
}

const encryptionKey = decodeEncryptionKey(process.env.AI_CONFIG_ENCRYPTION_KEY);

export function validateAIConfigEncryptionKey(raw: string | undefined): boolean {
  return decodeEncryptionKey(raw) !== null;
}

export function encryptSecret(value: string): string {
  if (!value) return value;
  if (!encryptionKey) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [PREFIX, iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
}

export function protectStoredSecret(value: string): string {
  if (value.startsWith(`${PREFIX}:`)) {
    decryptSecret(value);
    return value;
  }
  return encryptSecret(value);
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(`${PREFIX}:`)) return value;
  if (!encryptionKey) {
    throw new Error('AI_CONFIG_ENCRYPTION_KEY is required to decrypt stored AI credentials.');
  }

  const parts = value.split(':');
  if (parts.length !== 5) {
    throw new Error('Stored AI credential has an invalid encrypted format.');
  }
  const [, , ivValue, tagValue, encryptedValue] = parts;
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(ivValue, 'base64'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
