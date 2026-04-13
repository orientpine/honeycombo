export function verifyWebhookSecret(request: Request, env: { WEBHOOK_SECRET?: string }): boolean {
  const secret = env.WEBHOOK_SECRET;
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return false;
  }

  const token = authorization.slice('Bearer '.length);
  const maxLength = Math.max(secret.length, token.length);
  let mismatch = secret.length ^ token.length;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (secret.charCodeAt(index) || 0) ^ (token.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}
