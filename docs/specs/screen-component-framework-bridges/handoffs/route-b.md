# Route B Handoff

> 状态：已完成
> 最近更新：2026-08-03
> 任务：B1, B2, B3, B4, B5

## Conclusion

Route B now provides a shared strict canonical ScreenDocument, registry-aware core parser, nested document persistence, and a Dataset-backed metric host-resource gateway without document-derived transport configuration.

## Preconditions

- Read `p-gate.md` and the frozen route-B sections of `spec.md` and `tasks.md`.
- The worktree already contained concurrent documentation and core runtime changes; none were reverted. In particular, `screen-editor-core/src/contracts/adapter.ts` and `src/dynamic/data-adapter-port.ts` were modified by another owner and were not edited here.

## Modified Files

- `packages/shared/src/schemas/screen.schema.ts`: canonical strict document, JSON/host-resource boundary, Screen DTOs, resolver schemas, and JSON Schema.
- `packages/shared/src/contracts/screen.contract.ts`, `contracts/index.ts`: Screen CRUD and resource-gateway endpoint contract.
- `packages/shared/src/schemas/screen.schema.test.ts`, `screen-migration.test.ts`: canonical strict-wire and legacy-input rejection coverage.
- `packages/screen-editor-core/src/contracts/document.ts`, `json-schema.ts`: consume the shared document schema and apply registry-aware source/resource/event/action checks.
- `packages/screen-editor-core/src/contracts/dynamic-document.test.ts`: canonical parser behavior coverage.
- `apps/nestjs-server/src/modules/screen/**`: nested canonical persistence and authenticated/public resource gateway.
- `apps/nestjs-server/src/modules/dataset/{dataset.service.ts,dataset.service.spec.ts,dataset.module.ts,dto/dataset.dto.ts}`: Dataset-backed metric resolver operations, direct shared DTO wrappers, and removal of active DatasetReference use.
- `apps/nestjs-server/prisma/schema/Screen.prisma`: canonical non-null document field in the active Prisma model.

## Public Interfaces And Behavior

- `ScreenDocumentSchema` is the only active wire schema. It requires `schemaVersion: 1`, strict canvas/component/global-variable objects, and only `static | host-resource` data sources.
- `ScreenProjectSchema` and Screen API responses are `{ id, name, description, status, thumbnail, createdAt, updatedAt, document }`; document fields are no longer flattened.
- PATCH accepts optional metadata plus optional complete `document`. Omission preserves the stored document; `description: null` and `thumbnail: null` clear metadata; a provided document atomically replaces the previous document.
- `parseScreenDocument(input, registry)` first uses the shared schema, then validates registered type, manifest props, data capability/resource type, event handles, action handles, references, and `refreshData` targets. It fails closed.
- Resource endpoints are `GET /screen/:projectId/resources?resourceType=metric`, `POST /screen/:projectId/resources/execute`, and public, rate-limited `POST /screen/:projectId/preview/resources/execute`.
- The only resolver is `metric`. Its opaque `resourceId` is a Dataset ID and `Dataset.projectId === projectId` is checked before execution. Metric params and binding are strict empty objects, so Dataset server configuration remains the only request configuration source.
- Authenticated resource operations rely on the existing global JWT guard. Preview execute is `@Public()`, has a dedicated 30/minute throttle, and requires a published project. `contextId` and `componentId` are correlation-only and are not authorization inputs.
- Resolver output must be valid detached JSON and at most 1 MiB UTF-8 serialized. Invalid or oversized output returns a generic validation error without returning response content.
- Canonical Screen documents no longer maintain or consult DatasetReference. The implementation/table remains dormant for BUS deletion evidence; active Dataset deletion and reference count do not query it.

## Verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @nebula/shared test -- src/schemas/screen.schema.test.ts src/schemas/screen-migration.test.ts` | Passed | 49 tests |
| `pnpm --filter @nebula/shared typecheck` | Passed | Strict schema/type exports |
| `pnpm --filter @nebula/shared build` | Passed | Refreshed owned shared package output for Nest Jest resolution |
| `pnpm --filter @nebula/screen-editor-core test -- src/contracts/dynamic-document.test.ts` | Passed | 18 tests, including canonical parser semantics |
| `pnpm --filter @nebula/nestjs-server exec jest --runInBand --testPathPatterns="dataset.service.spec.ts|screen.service.spec.ts|screen.controller.spec.ts|screen-resource.service.spec.ts"` | Passed | 56 tests |
| `pnpm --filter @nebula/nestjs-server typecheck` | Passed | Nest module and DTOs |
| `pnpm exec prisma validate` | Passed | Prisma schema valid; no database reset performed |
| `pnpm exec biome check <route-B owned files>` | Passed | 20 source files |
| `pnpm --filter @nebula/screen-editor-core typecheck` | Blocked outside Route B | Route-D-owned flattened `ScreenProject` consumers require the new `project.document` shape; also reports pre-existing concurrent dynamic adapter API drift. |

## BUS Deferred Items

- No SQLite reset, data migration, or destructive Prisma migration was run. BUS must obtain explicit confirmation before dropping physical legacy columns and resetting development/E2E data.
- Root manifest, lockfile, package deletion, tarball verification, full workspace typecheck/lint, and E2E remain BUS work.

## Deletion Candidates

- Shared legacy Screen document migration helpers and `LegacyScreenDocumentSchema`.
- Legacy blocks and migration functions in `screen-editor-core/src/contracts/document.ts`.
- `dynamic-document.ts`, V3 parser/tests, and dynamic package/entrypoints after replacement evidence.
- Physical `screen_projects.canvas`, `components`, and `blueprint` columns, plus the DatasetReference model/table/service and its legacy API endpoint.

## Risks And Blockers

- The current repository has no project-membership authorization abstraction beyond global JWT/RBAC infrastructure. The gateway independently validates project/resource ownership but cannot add per-user project authorization without a new frozen contract.
- Metric resolver intentionally accepts no caller-controlled params or binding fields. A future metric parameter/binding shape needs a new resolver-specific allowlist and tests before expansion.

## Downstream And BUS Actions

- D: migrate all core consumers from flattened `ScreenProject` fields to `project.document`, consume `parseScreenDocument`, and converge core public exports. Retire inactive parser code only after replacement evidence.
- E: re-export the canonical shared schema/JSON Schema and use the nested project/resource gateway contracts in SDK declarations.
- G3: make the Web adapter call only the three resource-gateway endpoints and map nested project responses directly.
- BUS: perform confirmed database reset/destructive migration, remove legacy implementations and DatasetReference artifacts, regenerate the lockfile if package changes are made, and complete full-workspace validation.
