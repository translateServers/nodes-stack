// ── Shared types re-export ──────────────────────────────────────────
export {
  BizCode,
  type ApiErrorResponse,
  type ApiResponse,
  type PaginatedResponse,
  type PaginationQuery,
  BusinessError,
  getBizMessage,
  isBusinessError,
} from '@nebula/shared';
export * from '@nebula/shared';

// ── Core ────────────────────────────────────────────────────────────
export {
  default as http,
  BusinessError as HttpBusinessError,
  del,
  get,
  patch,
  post,
} from './core/http';
export * from './core/endpoints';
export * from './core/api-error';

// ── Module APIs ─────────────────────────────────────────────────────
export * as authApi from './modules/auth/api';
export * as userApi from './modules/user/api';
export * as healthApi from './modules/health/api';
export * as menuApi from './modules/menu/api';
export * as roleApi from './modules/role/api';
export * as dictApi from './modules/dict/api';

// ── Hooks ───────────────────────────────────────────────────────────
export * from './modules/auth/hooks';
export * from './modules/user/hooks';
export * from './modules/health/hooks';
export * from './modules/menu/hooks';
export * from './modules/role/hooks';
export * from './modules/dict/hooks';
