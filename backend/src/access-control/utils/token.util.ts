import * as crypto from 'crypto';

export function generateShareToken(): string {
  return crypto.randomBytes(32).toString('hex');  // 64 character hex string
}
