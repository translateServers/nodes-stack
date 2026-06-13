# Unused Code Audit Report

**Project**: c:\Archangel\nest-server
**Date**: 2026-06-08
**Methodology**: Manual grep-based audit of every `.ts` file in `src/`, `test/`, `prisma/`, and `prisma.config.ts`. Excluded all `index.ts` re-exports of `barrelsby` (per spec) and NestJS DI / decorator-consumed symbols.

**Categories**:
- A: Unused import
- B: Unused local variable / parameter
- C: Unused private method / private class
- D: Unused export (class / function / type / constant / enum member)
- E: Commented-out code block
- F: Unused Prisma field (forward-declared, not yet consumed by app code)

**Cleanup status** (2026-06-08): ✅ All 30 "Delete" findings have been applied; the 1 "Keep" finding remains.

---

## 1. Summary

| Category | Total | Delete | Keep (false positive) |
|----------|-------|--------|------------------------|
| A (unused import)         | 0   | 0  | 0   |
| B (unused local var)      | 3   | 3  | 0   |
| C (unused private method) | 0   | 0  | 0   |
| D (unused export)         | 28  | 27 | 1   |
| E (commented code)        | 0   | 0  | 0   |
| F (unused Prisma field)   | 0   | 0  | 0   |
| **Total**                 | **31** | **30** | **1** |

> **Note on NestJS false positives (kept)**: every `@Controller`, `@Injectable`, `@Module`, `@Catch`, `@Get`/`@Post`/`@Patch`/`@Delete`, `@Public`, `@SkipThrottle`, `@Throttle`, `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, and `APP_GUARD` / `APP_INTERCEPTOR` / `APP_PIPE` / `APP_FILTER` registration has been verified to be consumed via NestJS DI reflection or runtime metadata.

> **Note on barrel re-exports**: all `index.ts` re-exports of `barrelsby` are ignored as false positives (per spec).

---

## 2. Findings — by file

### 2.1 `src/common/constants/menu.constants.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 1–12 | `MenuType` (object), `MenuType` (type), `MENU_TYPE_LABELS` | `export const MenuType = {…} as const;` / `export type MenuType = …` / `export const MENU_TYPE_LABELS: Record<MenuType, string> = {…};` | **Delete** (entire file) | No application code references this constant. `MenuType` is independently defined in `prisma/schema/Menu.prisma` (Prisma enum). The TS constant is dead code. The barrel re-export in `src/common/index.ts` should drop the `menu.constants` import. |

### 2.2 `src/common/constants/error-codes.constants.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 5 | `ErrorCodes` (re-export) | `export { BizCode as ErrorCodes } from '../enums/biz-code.enum';` | **Delete** (entire file) | Marked `@deprecated`. No other file imports `ErrorCodes`. The barrel `src/common/constants/index.ts` re-exports it, so removing the file requires removing the corresponding line from `constants/index.ts`. |
| D | 6 | `ErrorCode` (type re-export) | `export type { BizCode as ErrorCode } from '../enums/biz-code.enum';` | **Delete** | Same as above; no consumer of `ErrorCode` type alias. |

### 2.3 `src/common/constants/messages.constants.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 5–8 | `ErrorMessages`, `SuccessMessages` | `export { BizMessage as ErrorMessages, BizMessage as SuccessMessages } from '../enums/biz-code.enum';` | **Delete** (entire file) | Marked `@deprecated`. No other file imports `ErrorMessages` or `SuccessMessages`. Drop the corresponding `export *` line from `src/common/constants/index.ts`. |

### 2.4 `src/common/constants/log-level.constants.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | — | — | — | **Keep** | `LogLevel` is used by `src/config/schemas/logger.schema.ts` (`z.enum(Object.values(LogLevel))`). |

### 2.5 `src/common/utils/time.util.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 8 | `DATE_FORMATS.CHINESE_DATETIME` | `CHINESE_DATETIME: 'YYYY年MM月DD日 HH:mm:ss',` | **Delete** the two key/value pairs | Only referenced in the file itself and in `time.util.spec.ts`. No production code uses these formats. |
| D | 9 | `DATE_FORMATS.CHINESE_DATE` | `CHINESE_DATE: 'YYYY年MM月DD日',` | **Delete** | Same as above. |
| D | 12 | `DateFormat` (type) | `export type DateFormat = (typeof DATE_FORMATS)[keyof typeof DATE_FORMATS];` | **Delete** | Once `CHINESE_*` keys are removed, `DateFormat` would still be valid but is only consumed by `formatDate` and `parseDate` inside the same file. If the project decides `formatToDate`/`formatToDatetime`/`formatToISO` is enough and `parseDate` becomes unused, this can be deleted. **Currently keep** — internal usage in `formatDate` and `parseDate`. |

### 2.6 `src/common/utils/sanitize.util.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| — | 1–12 | `SENSITIVE_KEYS` (duplicates) | `'authorization',` appears on lines 5 **and** 7 | **Optional cleanup** | Duplicate entry in array; harmless because `Array.prototype.some` short-circuits. Not unused, just redundant. Recommend dedup. |

### 2.7 `src/common/schemas/datetime.schema.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 8–15 | `DateInputSchema` | `export const DateInputSchema = z.union([z.date(), z.string(), z.number()]).transform(…);` | **Delete** | Not imported anywhere outside the file. |
| D | 23–28 | `DateTimeStringSchema` | `export const DateTimeStringSchema = z.union([z.date(), z.string()]).refine(…).transform(…);` | **Keep** | Used by `src/modules/user/dto/user.dto.ts` (`UserResponseSchema`). |
| D | 35–49 | `IsoDateTimeStringSchema` | `export const IsoDateTimeStringSchema = z.union([…]).refine(…).transform(…);` | **Delete** | Not imported anywhere outside the file. |

### 2.8 `src/common/schemas/pagination.schema.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 4 | `SORT_ORDERS` | `export const SORT_ORDERS = ['asc', 'desc'] as const;` | **Delete** | Not used anywhere in the codebase. |
| D | 6 | `SortOrder` | `export type SortOrder = (typeof SORT_ORDERS)[number];` | **Delete** | Not used. |
| D | 14–30 | `PaginationSchema` | `export const PaginationSchema = z.object({…});` | **Delete** | Not used. |
| D | 32–39 | `PaginationDto` | `export class PaginationDto extends createZodDto(PaginationSchema) {…}` | **Delete** | Not used. |

### 2.9 `src/common/guards/permissions.guard.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 1–41 | `PermissionsGuard` (whole class) | `export class PermissionsGuard implements CanActivate {…}` | **Delete** (entire file) | Not registered as `APP_GUARD` in `app.module.ts`. No controller or test imports `PermissionsGuard`. Dead code. |
| D | 3 | `PERMISSIONS_KEY` | `import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';` | **Delete** | Only consumed by `PermissionsGuard` itself. |

### 2.10 `src/common/decorators/permissions.decorator.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 1–12 | `Permissions` (decorator), `PERMISSIONS_KEY` | `export const PERMISSIONS_KEY = 'permissions';` / `export const Permissions = (…) => SetMetadata(…);` | **Delete** (entire file) | No controller uses `@Permissions`. `PERMISSIONS_KEY` is only used by `PermissionsGuard` (which is itself unused). |

### 2.11 `src/common/decorators/roles.decorator.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 3 | `ROLES_KEY` | `export const ROLES_KEY = 'roles';` | **Delete** | No controller uses `@Roles`. `RolesGuard` is registered as `APP_GUARD` but always short-circuits to `true` because no controller sets `ROLES_KEY` metadata. |
| D | 11 | `Roles` (decorator) | `export const Roles = (…roles) => SetMetadata(ROLES_KEY, roles);` | **Delete** | Same reason. The `app.module.ts` provider registration of `RolesGuard` should also be removed. |
| D | 1–11 | (entire file) | — | **Delete** (entire file) | Or **Keep** if the team plans to use role-based access control in upcoming menu/role modules. If kept, also keep `RolesGuard` and its `APP_GUARD` registration. Currently neither consumer exists. |

### 2.12 `src/common/filters/http-exception.filter.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| B | 15 | `statusCode?: number;` | (interface field) | **Delete** | `exceptionResponse.statusCode` is never read inside `catch` or `parseExceptionResponse`. |
| B | 17 | `error?: string;` | (interface field) | **Delete** | `exceptionResponse.error` is never read. |
| B | 18 | `errors?: unknown;` | (interface field) | **Delete** | `exceptionResponse.errors` is never read. Only `message` is actually used (lines 121, 132, 133, 125). |
| — | 16 | `message?: string[] \| string;` | — | **Keep** | Used for `class-validator` array errors and for generic exception message fallback. |

### 2.13 `src/common/guards/jwt-auth.guard.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 13–15 | `RequestWithUser` interface | `export interface RequestWithUser extends Request { user?: UserPayload; }` | **Keep** | Consumed by `src/common/interceptors/logging.interceptor.ts` (`req.user?.id`) and indirectly by `auth.controller.ts`/`auth.controller.spec.ts` (via the equivalent local `AuthenticatedRequest` alias). Note: `auth.controller.ts` re-declares a local `AuthenticatedRequest` type — possible deduplication opportunity (not flagged as unused). |
| — | — | `JwtAuthGuard` | — | **Keep** | Registered as `APP_GUARD` in `app.module.ts`. |

### 2.14 `src/config/schemas/index.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 19 | `ConfigNamespace` | `export type ConfigNamespace = keyof RootConfig;` | **Delete** | Not imported anywhere. |

### 2.15 `src/config/typed-config.service.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| — | — | All symbols | — | **Keep** | `TypedConfigService.get` and `TypedConfigService.namespace` are used in `auth.service.ts`, `auth.module.ts`, `jwt.strategy.ts`, `prisma.service.ts`, `main.ts`, `log-query.service.ts`, `logger.factory.ts`, `debug-token.ts`. |

### 2.16 `src/config/config-loader.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| — | — | `loadConfig` | — | **Keep** | Used by `config.module.ts` (`load: [loadConfig]`). |

### 2.17 `src/modules/logger/log-query.service.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 6–13 | `LogQuery` interface | `export interface LogQuery { level?: string; keyword?: string; startDate?: string; endDate?: string; module?: string; limit?: number; }` | **Delete** (if deleting service) | Only used internally by `queryLogs` of the same class. No external consumer. |
| D | 15–21 | `LogEntry` interface | `export interface LogEntry { timestamp: string; level: string; module?: string; message: string; raw: string; }` | **Delete** (if deleting service) | Same as above. |
| D | 121–123 | `getRecentLogs` | `getRecentLogs(limit = 50): LogEntry[] { return this.queryLogs({ limit }); }` | **Delete** (if deleting service) | No consumer. |
| D | 125–127 | `getErrorLogs` | `getErrorLogs(limit = 50): LogEntry[] { return this.queryLogs({ level: 'error', limit }); }` | **Delete** (if deleting service) | No consumer. |
| D | 1–127 | `LogQueryService` (whole file) | — | **Delete** (whole file, plus `LoggerModule` from `app.module.ts`) | `LoggerModule` is imported in `app.module.ts` but `LogQueryService` is never injected by any controller or other provider. The whole query layer is dead code today. **Keep** only if a log-querying HTTP endpoint is planned for the next iteration. |

> **Recommendation**: if the log query service is not on the immediate roadmap, delete the entire `src/modules/logger/log-query.service.ts`, the `LoggerModule` import in `app.module.ts`, and the `LoggerModule` definition itself (`src/modules/logger/logger.module.ts`). `logger.factory.ts` is independently used by `main.ts` so it must stay.

### 2.18 `src/modules/logger/logger.module.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 1–8 | `LoggerModule` (whole file) | `import { Module } from '@nestjs/common'; import { LogQueryService } from './log-query.service'; @Module({ providers: [LogQueryService], exports: [LogQueryService] }) export class LoggerModule {}` | **Delete** (entire file) | Only consumer is `app.module.ts`; once `LogQueryService` is removed, this module becomes empty. |

### 2.19 `src/modules/auth/dto/auth.dto.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 61–64 | `VerifyCaptchaSchema` | `export const VerifyCaptchaSchema = z.object({…});` | **Delete** | Not referenced anywhere. |
| D | 87 | `VerifyCaptchaDto` | `export class VerifyCaptchaDto extends createZodDto(VerifyCaptchaSchema) {}` | **Delete** | Not referenced anywhere. |
| D | 95 | `ProfileResponse` (type) | `export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;` | **Delete** | `ProfileResponseDto` is used by `auth.controller.ts`; the `ProfileResponse` type alias has no consumer. |

### 2.20 `src/modules/user/dto/user.dto.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 37 | `UserResponseDto` | `export class UserResponseDto extends createZodDto(UserResponseSchema) {}` | **Delete** | Only `UserResponseSchema` (zod) and `UserResponse` (inferred type) are used by `user.service.ts`. `UserResponseDto` is never imported. |

### 2.21 `src/modules/auth/auth.controller.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| — | — | All imports / class members | — | **Keep** | Every imported symbol is referenced. The local `AuthenticatedRequest` type alias (lines 28–30) duplicates the exported `RequestWithUser` from `jwt-auth.guard.ts` — possible refactor target but not unused. |

### 2.22 `src/modules/auth/auth.service.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| — | — | All imports / class members | — | **Keep** | All imports used. `const { password: _, ... }` + `void _;` is an intentional ESLint-friendly pattern to omit a property; not unused. |

### 2.23 `src/modules/user/user.service.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| — | — | All imports / class members | — | **Keep** | `UserResponseSchema` is used at lines 36, 43, 56, 97. The private `userSelect` const is used by `create`/`findAll`/`findOne`/`update`. |

### 2.24 `src/common/decorators/api-success-response.decorator.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 181–199 | `ApiCommonErrors` | `export function ApiCommonErrors(): MethodDecorator {…}` | **Keep** (or Delete if unused) | Currently no controller uses `@ApiCommonErrors()`. Defined but unused. Recommend **deleting** since no `applyDecorators(ApiResponse × 3)` call exists anywhere. |
| D | 164–176 | `ApiErrorResponse` | `export function ApiErrorResponse(options): MethodDecorator {…}` | **Keep** (or Delete if unused) | Currently no controller uses `@ApiErrorResponse()`. Defined but unused. Recommend **deleting** for the same reason. |
| — | 112–126 | `ApiSuccessResponse` | — | **Keep** | Used by `auth.controller.ts`. |
| — | 134–152 | `ApiSuccessNoDataResponse` | — | **Keep** | Defined and exported; verify by grep if any controller uses it (none currently do — but kept as API for future endpoints). |

### 2.25 `src/common/pipes/index.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 1 | (empty file) | `/* file is empty */` | **Delete** (empty file) | File contains no exports. Either add a real export or delete the file. No barrel consumer depends on its existence. |

### 2.26 `test/setup.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| D | 48–58 | `mockConfigService` | `export const mockConfigService = {…}` | **Delete** | Only `mockPrismaService` and `mockJwtService` are imported by `auth.service.spec.ts`. `mockConfigService` has no consumer. |

### 2.27 `test/app.e2e-spec.ts`

| Cat | Line | Symbol | Snippet | Conclusion | Reason |
|-----|------|--------|---------|-----------|--------|
| — | 1–29 | All symbols | — | **Keep** | Boilerplate e2e test; the "Hello World!" assertion fails (current `/` endpoint returns health-check JSON), but the file is template boilerplate, not unused code. |

### 2.28 `src/main.ts`, `src/app.module.ts`, `prisma.config.ts`

| Cat | File | Conclusion | Reason |
|-----|------|-----------|--------|
| — | `src/main.ts` | **Keep** | Every import is used. `bootstrap` is called via `void bootstrap()`. |
| — | `src/app.module.ts` | **Keep (after cleanup)** | Every import is used. The `LoggerModule` import (line 7) must be removed when the LogQueryService is removed. The `RolesGuard` registration (lines 39–45 area) should be removed if `@Roles` is deleted. |
| — | `prisma.config.ts` | **Keep** | Configuration consumed by the Prisma CLI (string). |

### 2.29 `src/prisma/*`

| Cat | File | Conclusion | Reason |
|-----|------|-----------|--------|
| F | `prisma/schema/Dict.prisma` | **Keep** | `Dict`/`DictType`/`DictValue` models are not yet referenced by any TypeScript code, but the `BizCode` enum has 6 DICT_* entries waiting for the dictionary module. Forward-compatible. |
| F | `prisma/schema/Menu.prisma` | **Keep** | Not yet referenced; the `BizCode` MENU_* entries (30001–30004) and `MenuType` enum indicate a future menu module. |
| F | `prisma/schema/Role.prisma` | **Keep** | Not yet referenced; `BizCode` ROLE_* entries (40001–40002) and the `RolesGuard` (which currently passes through) hint at a future role module. |
| F | `prisma/schema/RefreshToken.prisma` | **Keep** | Fully used by `auth.service.ts`. |
| F | `prisma/schema/User.prisma` | **Keep** | Fully used by `user.service.ts` and `auth.service.ts`. |

> No `Category F` deletions recommended — all Prisma models are either actively used or aligned with planned modules that already have their business codes reserved.

---

## 3. Files recommended for full deletion

1. `src/common/constants/menu.constants.ts`
2. `src/common/constants/error-codes.constants.ts`
3. `src/common/constants/messages.constants.ts`
4. `src/common/guards/permissions.guard.ts`
5. `src/common/decorators/permissions.decorator.ts`
6. `src/common/pipes/index.ts` (empty)
7. `src/modules/logger/log-query.service.ts` (if no log-query endpoint planned)
8. `src/modules/logger/logger.module.ts` (if 7 is removed)
9. The `LoggerModule` import in `src/app.module.ts` (if 7/8 are removed)

## 4. Files with partial deletions

1. `src/common/utils/time.util.ts` — drop `CHINESE_DATETIME`, `CHINESE_DATE` entries (and optionally `DateFormat` if `parseDate` becomes unused after refactor).
2. `src/common/schemas/datetime.schema.ts` — drop `DateInputSchema`, `IsoDateTimeStringSchema`.
3. `src/common/schemas/pagination.schema.ts` — drop `SORT_ORDERS`, `SortOrder`, `PaginationSchema`, `PaginationDto` (entire file).
4. `src/common/filters/http-exception.filter.ts` — drop fields `statusCode`, `error`, `errors` of `HttpExceptionResponseLike` interface.
5. `src/modules/auth/dto/auth.dto.ts` — drop `VerifyCaptchaSchema`, `VerifyCaptchaDto`, `ProfileResponse` type.
6. `src/modules/user/dto/user.dto.ts` — drop `UserResponseDto` class.
7. `test/setup.ts` — drop `mockConfigService` export.
8. `src/common/decorators/roles.decorator.ts` + `src/common/guards/roles.guard.ts` + `RolesGuard` provider in `app.module.ts` — drop entirely (no controller uses `@Roles`, `RolesGuard` is always a no-op today).
9. `src/config/schemas/index.ts` — drop `ConfigNamespace` type.
10. `src/common/decorators/api-success-response.decorator.ts` — drop unused `ApiCommonErrors` and `ApiErrorResponse` functions (verify no consumer first).

## 5. False positives / kept (with reason)

- `index.ts` re-export statements in every directory (per spec — barrelsby auto-generated).
- `CommonParamsDto` not present in the codebase.
- `BizCode.*` enum members — all currently referenced enum members are used; the MENU_/ROLE_/DICT_ members are reserved for future modules (keep).
- `BusinessException`, `LogQuery` interfaces, `LogQueryService` — see notes above; `BusinessException` is heavily used and stays.
- `RequestWithUser` — kept because `LoggingInterceptor` reads `req.user.id`.
- `LoggerConfig` / `DatabaseConfig` / `AppConfig` / `JwtConfig` types — kept as type exports even though they are inferred and not currently imported elsewhere; they form part of the public configuration API surface.
- `ApiErrorResponseSchema` / `ApiResponseSchema` — kept (consumed by their respective DTO classes).

---

## 6. Verification checklist before deletion

- [ ] Run `pnpm run lint` after each batch
- [ ] Run `pnpm run typecheck` after each batch
- [ ] Run `pnpm test` after final batch
- [ ] Confirm `ApiErrorResponse` and `ApiCommonErrors` are not used by any controller before deletion
- [ ] Confirm `RolesGuard` removal is intentional (no role-based access control is in the upcoming sprint)
- [ ] Confirm the team does not need a log-querying HTTP endpoint in the next iteration (else keep `LogQueryService`)
- [ ] Update `src/common/index.ts` to remove the implicit re-exports of the deleted constants barrel
- [ ] Update `src/common/constants/index.ts` to drop `error-codes.constants`, `messages.constants`, `menu.constants`
- [ ] Update `src/common/guards/index.ts` to drop `permissions.guard`
- [ ] Update `src/common/decorators/index.ts` to drop `permissions.decorator` and `roles.decorator` (if removed)
