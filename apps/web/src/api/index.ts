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

// ── Feature hooks (re-exported for backward compatibility) ───────────
export * from '@/features/auth/hooks';
export * from '@/features/user/hooks';
export * from '@/features/health/hooks';
export * from '@/features/menu/hooks';
export * from '@/features/role/hooks';
export * from '@/features/dict/hooks';
