# Nebula 项目测试策略方案

## 现状分析

### 后端 `apps/nestjs-server` -- 有基础，存在空白

| 已有测试 (9 个 spec)                     | 质量评价                                 |
| ---------------------------------------- | ---------------------------------------- |
| `auth.service.spec.ts` (277 行)          | 好 -- 覆盖 login/register/refresh/logout |
| `user.service.spec.ts` (424 行)          | 好 -- CRUD + 密码校验 + 分页             |
| `captcha.service.spec.ts` (111 行)       | 好 -- Redis mock + 暴力破解防护          |
| `auth.controller.spec.ts` (184 行)       | 可 -- 基本路由覆盖                       |
| `jwt-auth.guard.spec.ts` (96 行)         | 可 -- public/非public 路由               |
| `transform.interceptor.spec.ts` (96 行)  | 可                                       |
| `http-exception.filter.spec.ts` (121 行) | 可                                       |
| `sanitize.util.spec.ts` (129 行)         | 好                                       |
| `time.util.spec.ts` (161 行)             | 好                                       |

**缺失测试的关键模块：**

- `user.controller.ts` -- 用户 CRUD 的 HTTP 层
- `health.controller.ts` -- 健康检查端点
- `redis.service.ts` -- 懒加载/重连/断连逻辑
- `prisma.service.ts` -- 生命周期钩子
- `jwt.strategy.ts` -- JWT 验证策略

**E2E 现状：** 仅有脚手架 `app.e2e-spec.ts`（测试 `GET /` 返回 Hello World），已与实际路由不匹配。`jest-e2e.json` 缺少 `moduleNameMapper`（路径别名）。

**基础设施：** Jest 配置完善（覆盖率阈值 80%、路径别名映射），`test/setup.ts` 提供共享 mock。

---

### 前端 `apps/web` -- 零测试

- 未安装任何测试依赖（无 Vitest / Testing Library / Playwright）
- 无可测试文件
- Vite 项目适合用 Vitest（与 Vite 共享配置和插件体系）

---

### 共享包 `packages/shared` -- 零测试

- Zod schemas（auth/user/role/menu/dict/paginated）和 datetime 工具函数无测试
- 作为前后端共用的类型源，schema 正确性至关重要

---

## 建议方案

### Task 1: 后端单元测试补全

**优先级排序（按业务重要性 + 测试价值）：**

1. **`user.controller.spec.ts`** -- 测试 HTTP 层：参数校验、响应格式、权限控制（`@Public()` 装饰器）
2. **`health.controller.spec.ts`** -- 测试健康检查端点返回正确状态（对运维至关重要）
3. **`redis.service.spec.ts`** -- 测试懒加载行为、`connectInBackground` 重试逻辑、`onModuleDestroy` 断连
4. **`jwt.strategy.spec.ts`** -- 测试 token 验证、payload 提取

**编写规范建议：**

- 统一使用 `test/setup.ts` 中的共享 mock，避免重复定义
- 每个 `describe` 块前 `jest.clearAllMocks()`
- 测试异常路径：`BusinessException` 的 bizCode + HTTP statusCode
- Controller 测试使用 NestJS `Test.createTestingModule`，而非 supertest（那是 e2e 的职责）

---

### Task 2: 后端 E2E 测试重构

**当前问题：**

- `jest-e2e.json` 缺少 `moduleNameMapper`，无法解析 `@/` 路径别名
- 测试用例已失效（`GET /` 不存在）
- 缺少测试数据库隔离

**建议架构：**

```
test/
  jest-e2e.json          -- 补充 moduleNameMapper
  setup-e2e.ts           -- E2E 专用 setup：test DB 初始化/清理
  helpers/
    auth.helper.ts       -- 封装注册/登录获取 token 的辅助函数
  app.e2e-spec.ts        -- 重写为完整的应用级测试
  auth.e2e-spec.ts       -- 认证流程：注册 -> 登录 -> 刷新token -> 登出
  user.e2e-spec.ts       -- 用户 CRUD：需鉴权，测试权限隔离
  health.e2e-spec.ts     -- 健康检查端点
```

**`jest-e2e.json` 需补充：**

```json
{
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/../src/$1"
  },
  "setupFilesAfterSetup": ["<rootDir>/setup-e2e.ts"]
}
```

**关键测试流程：**

- 注册 -> 登录 -> 获取 profile（验证 JWT 鉴权生效）
- 登录 -> 刷新 token -> 旧 token 失效
- 未登录访问受保护端点 -> 401
- 验证码生成 -> 验证通过 -> 验证码不可重复使用

---

### Task 3: 前端单元测试搭建

**技术选型：Vitest + @testing-library/react**

理由：Vitest 与 Vite 共享 transform 管道和配置，零额外构建开销。

**需安装的依赖：**

```bash
pnpm -C apps/web add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**`vite.config.ts` 追加 Vitest 配置：**

```ts
/// <reference types="vitest/config" />
export default defineConfig({
  // ...existing config
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
```

**测试文件规划（按优先级）：**

| 文件                                  | 测试重点                                                 |
| ------------------------------------- | -------------------------------------------------------- |
| `src/store/auth.test.ts`              | zustand store: setTokens / clearAuth / persist rehydrate |
| `src/store/ui.test.ts`                | zustand store: toggleMobileSidebar / closeMobileSidebar  |
| `src/api/core/api-error.test.ts`      | API 错误解析逻辑                                         |
| `src/components/RequireAuth.test.tsx` | 未认证重定向 / 已认证放行                                |
| `src/pages/Login.test.tsx`            | 表单提交 / 验证码渲染 / 错误提示 / loading 态            |

---

### Task 4: 前端 E2E 测试

**技术选型：Playwright**

理由：

- 微软维护，API 设计现代，auto-wait 机制稳定
- 原生支持 Chromium / Firefox / WebKit
- 与 Vite 配合良好，可用 `webServer` 配置自动启动 dev server

**需安装的依赖：**

```bash
pnpm -C apps/web add -D @playwright/test
```

**目录结构：**

```
apps/web/e2e/
  auth.spec.ts          -- 登录流程：填写表单 -> 提交 -> 跳转首页
  navigation.spec.ts    -- 未登录访问 /login -> 登录后访问 Dashboard
```

**`playwright.config.ts` 核心配置：**

```ts
export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:5173' },
});
```

---

### Task 5: 共享包测试

**技术选型：Vitest**（轻量，与 monorepo 兼容好）

**测试文件规划：**

| 文件                                        | 测试重点                                              |
| ------------------------------------------- | ----------------------------------------------------- |
| `src/schemas/__tests__/auth.schema.test.ts` | loginDto / registerDto 的校验规则（边界值、类型错误） |
| `src/schemas/__tests__/user.schema.test.ts` | createUserDto / updateUserDto 校验                    |
| `src/utils/__tests__/datetime.test.ts`      | 日期格式化工具函数                                    |

Zod schema 测试的价值：schema 是前后端共用的校验契约，任何意外变更都会同时影响两端。

---

### Task 6: Monorepo 测试编排

**在 `turbo.json` 中添加 test 任务：**

```json
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "test:e2e": {
      "dependsOn": ["^build"],
      "cache": false
    }
  }
}
```

**各 package.json 补充 scripts：**

| 包                   | 新增脚本                                                                          |
| -------------------- | --------------------------------------------------------------------------------- |
| `apps/nestjs-server` | 已有 `test` / `test:e2e`，无需改动                                                |
| `apps/web`           | `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:e2e": "playwright test"` |
| `packages/shared`    | `"test": "vitest run"`, `"test:watch": "vitest"`                                  |
| 根 `package.json`    | `"test": "turbo run test"`, `"test:e2e": "turbo run test:e2e"`                    |

---

## 优先级建议

| 优先级 | Task                  | 预估工作量 | 理由                                           |
| ------ | --------------------- | ---------- | ---------------------------------------------- |
| P0     | Task 1: 后端单测补全  | 2-3h       | 现有代码质量不错，补 4 个 spec 文件即可        |
| P0     | Task 2: 后端 E2E 重构 | 2-3h       | 当前 E2E 完全失效，需修复基础设施 + 写核心流程 |
| P1     | Task 3: 前端单测搭建  | 3-4h       | 从零搭建，但优先覆盖 store 和 auth 组件        |
| P1     | Task 5: 共享包测试    | 1-2h       | Zod schema 测试编写快速，ROI 高                |
| P2     | Task 4: 前端 E2E      | 2-3h       | 依赖后端可用，建议后端 E2E 稳定后再做          |
| P2     | Task 6: Turbo 编排    | 0.5h       | 所有测试就位后统一配置                         |
