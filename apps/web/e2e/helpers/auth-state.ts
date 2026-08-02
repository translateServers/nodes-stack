import type { AuthTokens } from './api-client';

export type E2eAuthRole = 'admin' | 'viewer';

export type WorkerAuthTokens = Readonly<Record<E2eAuthRole, AuthTokens>>;

let workerAuthTokens: WorkerAuthTokens | undefined;

export function setWorkerAuthTokens(tokens: WorkerAuthTokens): void {
  workerAuthTokens = tokens;
}

export function getWorkerAuthTokens(role: E2eAuthRole): AuthTokens {
  if (!workerAuthTokens) {
    throw new Error('E2E worker authentication has not been initialized.');
  }
  return workerAuthTokens[role];
}

export function clearWorkerAuthTokens(): void {
  workerAuthTokens = undefined;
}
