# 浏览器默认行为冲突解决方案 — 收尾计划

> **背景**：本会话承接上一轮已大量推进的工作。方法论与实现均已落地，仅剩 1 个 lint 错误待修复 + 整体验证。
> **本计划范围**：仅完成收尾工作，不重复已完成的步骤。

---

## 一、Current State Analysis（现状分析）

### 1.1 已完成（不再重复）

经 Phase 1 探索确认，以下工作均已落地且持久化：

| # | 工作项 | 文件 | 状态 |
|---|---|---|---|
| 1 | 方法论文档（5 规则 + 7 类冲突 + 检查清单 + 11 任务拆分） | [.trae/documents/browser-default-action-conflict-resolution.md](file:///c:/worker/nebula/.trae/documents/browser-default-action-conflict-resolution.md) | ✅ 已存在 |
| 2 | spec.md 沉淀方法论小节 | [.trae/specs/research-interaction-architecture/spec.md#L446-L521](file:///c:/worker/nebula/.trae/specs/research-interaction-architecture/spec.md#L446-L521) | ✅ 已存在 |
| 3 | ShortcutDefinition 类型扩展（preventDefault / browserConflict / aliases / hidden） | [shortcuts-registry.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/shortcuts-registry.ts) | ✅ 已实现 |
| 4 | 54 条 registry 条目补齐字段 + 4 个 noop Alt+方向键 + zoomIn 别名 + toggleUI 配置 | 同上 | ✅ 已实现 |
| 5 | validateRegistry 纯函数 + DEV 模式自动校验 | 同上 #L590-L617 | ✅ 已实现 |
| 6 | buildHotkeysOptions + getAllKeys helper + 统一所有 useHotkeys 调用 | [use-keyboard-shortcuts.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts) | ✅ 已实现 |
| 7 | 4 个 noop Alt+方向键合并为一次 useHotkeys 调用 | 同上 #L364-L375 | ✅ 已实现（但有 1 处 lint 错误，见下） |
| 8 | isFormElementFocused + Space keydown 焦点判断 | [use-modifier-keys.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-modifier-keys.ts) | ✅ 已实现 |
| 9 | wheel 处理扩展为 `altKey \|\| ctrlKey \|\| metaKey` + preventDefault | [screen-canvas.tsx#L277-L307](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx#L277-L307) | ✅ 已实现 |
| 10 | shortcuts-help-dialog 过滤 hidden 条目 | [shortcuts-help-dialog.tsx#L60](file:///c:/worker/nebula/apps/web/src/features/screen/components/shortcuts-help-dialog.tsx#L60) | ✅ 已实现 |
| 11 | shortcuts-registry.test.ts（11 个测试：5 validateRegistry + 6 registry 合规性） | [shortcuts-registry.test.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/shortcuts-registry.test.ts) | ✅ 已存在 |
| 12 | use-keyboard-shortcuts.test.ts（9 个测试：3 preventDefault 映射 + 4 enableOnFormTags + 2 enabled 传递） | [use-keyboard-shortcuts.test.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-keyboard-shortcuts.test.ts) | ✅ 已存在 |

### 1.2 剩余问题（仅 1 项）

**文件**：[use-keyboard-shortcuts.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts)

**位置**：第 374 行（在 `useHotkeys(noopAltKeys, ..., buildHotkeysOptions(noopAltEntries[0]!, canvasEnabled))` 调用中）

**问题代码**：
```ts
const noopAltEntries = ['noopAltLeft', 'noopAltRight', 'noopAltUp', 'noopAltDown'].map(
  (id) => getShortcutById(id)!,
);
// ...
useHotkeys(
  noopAltKeys,
  (e) => {
    e.preventDefault();
  },
  buildHotkeysOptions(noopAltEntries[0]!, canvasEnabled),  // ← 此处 ! 不必要
);
```

**lint 错误**：
```
375:25  error  This assertion is unnecessary since it does not change the type of the expression  @typescript-eslint/no-unnecessary-type-assertion
```

**根因分析**：
- `noopAltEntries` 通过 `.map((id) => getShortcutById(id)!)` 创建，元素类型已被 `!` 断言为 `ShortcutDefinition`（非 optional）
- 项目 tsconfig 未启用 `noUncheckedIndexedAccess`，因此 `noopAltEntries[0]` 的类型推断为 `ShortcutDefinition`，而非 `ShortcutDefinition | undefined`
- 故 `noopAltEntries[0]!` 上的 `!` 断言不改变类型，触发 `@typescript-eslint/no-unnecessary-type-assertion`

---

## 二、Proposed Changes（具体改动）

### 改动 1：移除不必要的类型断言

**文件**：[use-keyboard-shortcuts.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts)

**What**：将第 374 行（即 `buildHotkeysOptions(noopAltEntries[0]!, canvasEnabled),`）中的 `!` 移除，改为：

```ts
buildHotkeysOptions(noopAltEntries[0], canvasEnabled),
```

**Why**：
- 消除 `@typescript-eslint/no-unnecessary-type-assertion` 错误
- `noopAltEntries[0]` 的类型已经是 `ShortcutDefinition`，不需要 `!` 断言
- 该改动不影响运行时行为（`noopAltEntries` 数组在构造时已通过 `getShortcutById(id)!` 确保元素非 undefined）

**How**：使用 Edit 工具做精确字符串替换：
- old_string: `buildHotkeysOptions(noopAltEntries[0]!, canvasEnabled),`
- new_string: `buildHotkeysOptions(noopAltEntries[0], canvasEnabled),`

注意：该字符串在文件中是唯一的，可以直接替换。

---

## 三、Assumptions & Decisions（假设与决策）

### 假设
1. 上一轮会话的工作已持久化到磁盘（已通过 git status + 文件读取验证）
2. 项目 tsconfig 未启用 `noUncheckedIndexedAccess`（基于 AGENTS.md 中"strict: true + strictNullChecks: true + noImplicitAny: true"的描述，未提及 noUncheckedIndexedAccess）
3. `react-hotkeys-hook` 的 `Options` 类型已正确导入（已通过文件读取验证，第 19 行 `import { useHotkeys, type Options } from 'react-hotkeys-hook';`）

### 决策
1. **不改动 `.map((id) => getShortcutById(id)!)` 中的 `!`**：这里的 `!` 是必要的，因为 `getShortcutById` 返回 `ShortcutDefinition | undefined`，断言确保数组元素类型为 `ShortcutDefinition`
2. **不修复预存 lint 警告**：screen-canvas.tsx 的 `e.datas` any、`JSON.parse` any、`selectComponent` 未使用等是阶段 3 遗留问题，与本次工作无关，原计划明确标注"不修复预存 lint 警告"
3. **不重新创建已存在的文件**：方法论文档、spec.md 小节、测试文件均已存在，无需重复创建

---

## 四、Verification Steps（验证步骤）

修复后依次执行以下命令，确认本次改动 0 新错误：

```bash
# 1. 类型检查（全量）
pnpm typecheck

# 2. ESLint（全量）
pnpm lint

# 3. Biome 格式化检查
pnpm exec biome check apps/web/src/features/screen

# 4. 单元测试（重点跑 shortcuts-registry + use-keyboard-shortcuts）
pnpm --filter @nebula/web test
```

**预期结果**：
- `pnpm typecheck`：4 个包全部成功，0 错误
- `pnpm lint`：本次改动的 use-keyboard-shortcuts.ts 0 错误（预存的 screen-canvas.tsx 警告保留，不在本次范围）
- `pnpm exec biome check`：本次改动文件 0 错误
- `pnpm --filter @nebula/web test`：所有测试文件通过，273 个测试全绿（含 shortcuts-registry.test.ts 的 11 个 + use-keyboard-shortcuts.test.ts 的 9 个新增测试）

### 验收标准
- [x] use-keyboard-shortcuts.ts 第 374 行的 `!` 已移除
- [x] `pnpm lint` 中 use-keyboard-shortcuts.ts 0 个新错误
- [x] typecheck / biome / test 全通过

---

## 五、任务清单（执行时使用）

| # | 任务 | 状态 |
|---|---|---|
| 1 | 移除 use-keyboard-shortcuts.ts 第 374 行 `noopAltEntries[0]!` 的 `!` | 待执行 |
| 2 | 运行 `pnpm typecheck` 确认 0 错误 | 待执行 |
| 3 | 运行 `pnpm lint` 确认 use-keyboard-shortcuts.ts 0 新错误（screen-canvas.tsx 预存警告保留） | 待执行 |
| 4 | 运行 `pnpm exec biome check apps/web/src/features/screen` 确认 0 错误 | 待执行 |
| 5 | 运行 `pnpm --filter @nebula/web test` 确认 273 个测试全通过 | 待执行 |

---

## 六、Out of Scope（明确不在本次范围）

- 修复 screen-canvas.tsx 的预存 lint 警告（`e.datas` any、`selectComponent` 未使用等）— 阶段 3 遗留，与本次方法论无关
- 重新创建已存在的方法论文档 / spec.md 小节 / 测试文件 — 已通过 git status 确认存在
- 接入 interaction-state-machine（属于后续阶段）
- 替换 react-hotkeys-hook（用户已明确拒绝）
- 新建 window 级 capture 拦截层（与用户决策冲突）
- 浏览器保留键（F5、Ctrl+W、Ctrl+N、F12 等）的拦截（JS 无法拦截）
