import * as crypto from 'crypto';

export function hashPayload(payload: object): string {
  const jsonString = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto
    .createHash('sha256')
    .update(jsonString)
    .digest('hex');
}
