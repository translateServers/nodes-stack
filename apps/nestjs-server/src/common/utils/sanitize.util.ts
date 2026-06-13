const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'refreshToken',
  'accessToken',
  'creditCard',
  'ssn',
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((k) => lower.includes(k.toLowerCase()));
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T, mask = '***'): T {
  const sanitized = { ...obj };
  for (const key of Object.keys(sanitized)) {
    if (isSensitiveKey(key)) {
      sanitized[key as keyof T] = mask as T[keyof T];
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key as keyof T] = sanitizeObject(
        sanitized[key] as Record<string, unknown>,
        mask,
      ) as T[keyof T];
    }
  }
  return sanitized;
}

export function sanitizeString(text: string, mask = '***'): string {
  let result = text;
  for (const key of SENSITIVE_KEYS) {
    const regex = new RegExp(`(${key}[=:\\s"']*)[^\\s"']+`, 'gi');
    result = result.replace(regex, `$1${mask}`);
  }
  return result;
}
