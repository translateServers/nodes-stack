const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface RegisterParams {
  email: string;
  username: string;
  password: string;
  name?: string;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${method} ${path} failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (json.code !== 0) {
    throw new Error(`API ${method} ${path} business error (${json.code}): ${json.message}`);
  }

  return json.data;
}

export async function register(params: RegisterParams): Promise<AuthTokens> {
  return request<AuthTokens>('POST', '/auth/register', params);
}

export async function refreshToken(refreshTokenValue: string): Promise<AuthTokens> {
  return request<AuthTokens>('POST', '/auth/refresh', {
    refreshToken: refreshTokenValue,
  });
}

export function decodeJwtPayload(token: string): { sub: string; exp: number; iat: number } {
  const payload = token.split('.')[1];
  const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
  return JSON.parse(decoded) as { sub: string; exp: number; iat: number };
}

export function isTokenExpiringSoon(token: string, thresholdSeconds = 60): boolean {
  const payload = decodeJwtPayload(token);
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - nowSeconds < thresholdSeconds;
}
