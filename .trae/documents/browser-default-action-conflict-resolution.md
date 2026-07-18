# 浏览器默认行为冲突解决方案

> **目标**：① 修复已识别的 7 类具体冲突；② 沉淀一套方法论，让未来新增快捷键时能系统性避免同类问题。
> **架构约束**：不替换 react-hotkeys-hook，不新建 window 级 capture 拦截层，所有改动在现有 `shortcuts-registry` + `use-keyboard-shortcuts` + `use-modifier-keys` + `screen-canvas` 框架内完成。
> **方法来源**：基于 [Phase 1 调研报告](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts) 的 7 类已识别冲突点。

---

## 一、Current State Analysis（现状分析）

### 1.1 已识别的 7 类冲突

| # | 冲突 | 文件 | 后果 |
|---|---|---|---|
| 1 | nudge 方向键（含 Shift+方向键）8 个快捷键未 preventDefault | [use-keyboard-shortcuts.ts#L239-L262](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts) | 画布在可滚动容器内时，方向键移动组件同时滚动页面 |
| 2 | Alt+方向键未注册 noop + preventDefault | 同上 | macOS / Firefox 下 Alt+Left/Right 触发浏览器历史后退/前进，导致离开编辑器 |
| 3 | Ctrl/Cmd+滚轮未实现，且 wheel handler `if (!e.altKey) return;` 不拦截 | [screen-canvas.tsx#L278](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx) | Ctrl+滚轮触发浏览器原生页面缩放，画布变模糊 |
| 4 | lock / unlock / hide / clearSelection / toggleBorderGuides 未 preventDefault | [use-keyboard-shortcuts.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts) | `mod+l` 聚焦地址栏（浏览器顶层）、`mod+k` Firefox 聚焦搜索栏 |
| 5 | Tab toggleUI 无 enabled 限制 | 同上 | 焦点在 Radix Popover/Dialog 按钮上时按 Tab 触发 toggleUI，干扰焦点流转 |
| 6 | 无 activeElement / isContentEditable 手写判断 | 全 feature grep 0 匹配 | 自研 contenteditable 文本组件聚焦时，global scope 快捷键仍触发 |
| 7 | `mod+=` 与 `mod+shift+=` 歧义 | [shortcuts-registry.ts#L82](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/shortcuts-registry.ts) | US 键盘 `+` 需要 Shift+=，react-hotkeys-hook 可能漏掉浏览器 Ctrl++ 拦截 |

### 1.2 架构现状摘要

- **单一数据源**：`shortcuts-registry.ts` 导出 `SHORTCUTS_REGISTRY` 数组（54 条），同时供绑定层与帮助面板消费
- **绑定层**：`use-keyboard-shortcuts.ts` 基于 `react-hotkeys-hook` 的 `useHotkeys`
- **修饰键状态**：`use-modifier-keys.ts` 单独管理 space/shift/alt/ctrl + window blur 兜底
- **wheel 监听**：`screen-canvas.tsx` 第 302 行 `{ passive: false }` ✅，可正确 preventDefault
- **焦点屏蔽**：完全依赖 react-hotkeys-hook 的 `enableOnFormTags` 选项，无手写 activeElement 判断
- **interaction-state-machine**：已存在但未接入画布，preventDefault 决策散落

### 1.3 现有 preventDefault 的两种风格（不统一）

```
风格 A：callback 内调用 e.preventDefault()
useHotkeys('mod+z', (e) => { e.preventDefault(); undo(); });

风格 B：option preventDefault: true
useHotkeys('mod+s', save, { preventDefault: true });
```

两种风格并存导致：新增快捷键时开发者不知道该用哪种、是否会漏掉，也没有审计机制。

---

## 二、方法论：快捷键防冲突的 5 条规则

未来新增快捷键时必须遵循以下规则，规则会沉淀到 `shortcuts-registry.ts` 的类型系统与开发时校验中。

### 规则 1：显式声明 preventDefault 语义

每条 registry 条目必须显式声明 `preventDefault` 字段，取值：

| 取值 | 语义 | 对应 useHotkeys 用法 |
|---|---|---|
| `'always'` | 任何情况下都阻止默认行为（与浏览器原生冲突的键必须用此值） | `{ preventDefault: true }` + callback 内 `e.preventDefault()` 双保险 |
| `'callback-only'` | 仅在 callback 执行路径内阻止（用于条件性 preventDefault，如 canvasEnabled 时才阻止） | callback 内 `if (cond) e.preventDefault()` |
| `'none'` | 不阻止默认行为（极少使用，仅用于纯只读快捷键如显示帮助 tooltip） | 不传 preventDefault 选项 |

**禁止**：不声明 `preventDefault` 字段的条目（开发时校验会报 warning）。

### 规则 2：标注浏览器冲突类别

每条 registry 条目必须声明 `browserConflict` 字段：

| 取值 | 含义 | 示例 |
|---|---|---|
| `'reserved'` | 浏览器保留键，JS 无法拦截（F5、Ctrl+W、Ctrl+N、F12 等） | 注册了也无意义，应跳过 |
| `'overridable'` | 浏览器有默认行为但 JS 可拦截（Ctrl+S、Ctrl+Z、Ctrl+0、方向键滚动、Alt+方向历史导航等） | 必须 `preventDefault: 'always'` 或 `'callback-only'` |
| `'none'` | 无浏览器默认行为冲突（如 `v`、`h`、`t` 工具切换） | 可 `preventDefault: 'none'` |

**`browserConflict: 'overridable'` 的条目必须搭配 `preventDefault: 'always' | 'callback-only'`**，开发时校验会强制此约束。

### 规则 3：显式声明 scope 与 enableOnFormTags

- `scope: 'global'` → 需明确 `enableOnFormTags: true | false`
- `scope: 'canvas'` → `enableOnFormTags` 默认 false，可不写
- **新增规则**：`scope: 'global'` + `enableOnFormTags: false` 的组合（如 toggleUI）必须在条目注释中说明"为何在表单中禁用"，避免误用

### 规则 4：键盘 + 鼠标组合操作必须在 pointerdown / wheel 阶段 preventDefault

- 不要依赖 keydown 阶段阻止（用户先按下鼠标再按修饰键的时序无法用 keydown 拦截）
- wheel 事件必须在 `passive: false` 监听器内 preventDefault
- 任何 `e.altKey / e.ctrlKey / e.metaKey / e.shiftKey` 分支必须显式 preventDefault

### 规则 5：新增快捷键前的检查清单

新增快捷键时，PR 必须自检以下项目（沉淀到 spec.md 的"新增快捷键检查清单"小节）：

```
[ ] 该组合键是否与浏览器原生冲突？（查 https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key + 实测）
[ ] 若冲突，是否标注 browserConflict: 'overridable' 并 preventDefault: 'always' | 'callback-only'
[ ] 是否声明 scope 与 enableOnFormTags
[ ] 是否在 shortcuts-help-dialog 中可见
[ ] 是否需要别名（如 mod+= 与 mod+shift+=）
[ ] 是否需要处理 contenteditable 焦点情况
```

### 方法论的落地形式

- **类型层**：扩展 `ShortcutEntry` 类型，新增 `preventDefault` / `browserConflict` 必填字段
- **校验层**：新增 `validateRegistry()` 纯函数，在开发模式（`import.meta.env.DEV`）下 console.warn 违反规则的条目
- **执行层**：`use-keyboard-shortcuts.ts` 根据 registry 的 `preventDefault` 字段统一生成 useHotkeys 选项，消除"风格 A / 风格 B"双轨制
- **文档层**：在 `spec.md` 新增"快捷键防冲突方法论"小节，固化 5 条规则与检查清单

---

## 三、Proposed Changes（具体改动）

### 改动 1：扩展 ShortcutEntry 类型与 registry 元数据

**文件**：[shortcuts-registry.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/shortcuts-registry.ts)

**What**：
1. 扩展 `ShortcutEntry` 类型：
   ```ts
   export type PreventDefaultLevel = 'always' | 'callback-only' | 'none';
   export type BrowserConflict = 'reserved' | 'overridable' | 'none';

   export interface ShortcutEntry {
     id: string;
     keys: string;
     description: string;
     category: 'file' | 'edit' | 'view' | 'component' | 'align' | 'tool' | 'ui' | 'help';
     scope: 'global' | 'canvas';
     preventDefault: PreventDefaultLevel;       // 新增，必填
     browserConflict: BrowserConflict;          // 新增，必填
     enableOnFormTags?: boolean;                  // 已有
     aliases?: string[];                          // 新增，用于 mod+= / mod+shift+= 这类别名
   }
   ```

2. 为现有 54 条 registry 条目补齐 `preventDefault` 与 `browserConflict` 字段。重点修改：
   - nudge 8 条：`browserConflict: 'overridable'`, `preventDefault: 'always'`
   - lock / unlock / hide / clearSelection / toggleBorderGuides：`browserConflict: 'overridable'`, `preventDefault: 'always'`
   - save / undo / redo / delete / selectAll / copy / paste / duplicate / zoomIn / zoomOut / fitToScreen / toggleGuides / showHelp / bringToFront / sendToBack / group / ungroup / align* / distribute*：`browserConflict: 'overridable'`, `preventDefault: 'always'`
   - v / h / t / cycleScreenMode：`browserConflict: 'none'`, `preventDefault: 'none'`
   - toggleUI（Tab）：`browserConflict: 'overridable'`, `preventDefault: 'always'`
   - brushSizeDecrease / Increase（`[` / `]`）：`browserConflict: 'none'`, `preventDefault: 'none'`

3. 为 `zoomIn` 增加 `aliases: ['mod+shift+=']`（解决规则 7 的歧义）

4. 新增条目：
   - `alt+up` / `alt+down` / `alt+left` / `alt+right`：`description: 'noop（拦截浏览器历史导航）'`, `scope: 'canvas'`, `preventDefault: 'always'`, `browserConflict: 'overridable'`，callback 为空函数

**Why**：方法论落地的类型系统与单一数据源，所有后续修复都基于此。

**How**：直接修改 `ShortcutEntry` 类型，然后逐条补充字段。Biome 会强制排序保持一致。

### 改动 2：新增 registry 校验函数

**文件**：[shortcuts-registry.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/shortcuts-registry.ts)

**What**：在文件末尾新增：
```ts
export function validateRegistry(registry: ShortcutEntry[]): string[] {
  const warnings: string[] = [];
  for (const entry of registry) {
    if (entry.browserConflict === 'overridable' && entry.preventDefault === 'none') {
      warnings.push(`[${entry.id}] browserConflict='overridable' 但 preventDefault='none'，将触发浏览器默认行为`);
    }
    if (entry.browserConflict === 'reserved') {
      warnings.push(`[${entry.id}] browserConflict='reserved'，JS 无法拦截，注册无效`);
    }
  }
  return warnings;
}

if (import.meta.env.DEV) {
  const warnings = validateRegistry(SHORTCUTS_REGISTRY);
  if (warnings.length > 0) {
    console.warn('[shortcuts-registry] 防冲突校验警告：\n' + warnings.join('\n'));
  }
}
```

**Why**：让规则 1 / 2 的违反在开发时立即暴露，避免新增快捷键漏配置。

**How**：纯函数 + 副作用隔离在 `import.meta.env.DEV` 块内，生产构建会被 tree-shake 移除。

### 改动 3：统一 use-keyboard-shortcuts 的 preventDefault 应用

**文件**：[use-keyboard-shortcuts.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-keyboard-shortcuts.ts)

**What**：
1. 抽取一个 helper 函数 `buildHotkeysOptions(entry, enabled)`，根据 `entry.preventDefault` 与 `entry.enableOnFormTags` 统一生成 useHotkeys 第三个参数：
   ```ts
   function buildHotkeysOptions(
     entry: ShortcutEntry,
     enabled: boolean,
   ): UseHotkeysOptions {
     return {
       enabled,
       preventDefault: entry.preventDefault === 'always',
       enableOnFormTags: entry.enableOnFormTags ?? (entry.scope === 'global'),
     };
   }
   ```

2. 将所有 `useHotkeys(...)` 调用改为读 registry 的 `preventDefault` 字段，消除"风格 A / B"双轨制。callback 内对 `preventDefault: 'callback-only'` 的条目仍然保留 `e.preventDefault()`，但 `'always'` 与 `'none'` 的条目不再需要在 callback 内手写。

3. 处理 `aliases` 字段：对有 `aliases` 的条目，循环 useHotkeys 绑定每个别名。

4. **Tab toggleUI 增加 `enabled: canvasEnabled`**：修复规则 5 的冲突点。当用户在表单/对话框中时不触发 toggleUI；保留 `enableOnFormTags: false` 让 input 内 Tab 仍能正常切换焦点。

**Why**：消除双轨制 + 修复 Tab 干扰 Radix 焦点流转。

**How**：先抽取 helper，再批量替换。替换时保持 callback 逻辑不变，只调整 options 与 callback 内的 `e.preventDefault()`。

### 改动 4：扩展 wheel 处理覆盖 Ctrl/Cmd+滚轮

**文件**：[screen-canvas.tsx](file:///c:/worker/nebula/apps/web/src/features/screen/components/screen-canvas.tsx)

**What**：
1. 修改 `handleWheel`（第 277-300 行），将触发条件从 `if (!e.altKey) return;` 扩展为：
   ```ts
   const isZoomGesture = e.altKey || e.ctrlKey || e.metaKey;
   if (!isZoomGesture) return;
   e.preventDefault();
   // ... 其余缩放逻辑保持不变
   ```

2. 保持 `{ passive: false }` 监听器配置不变（已经正确）。

3. 在缩放方向上，Ctrl/Cmd+滚轮与 Alt+滚轮行为一致：向上滚放大、向下滚缩小。

**Why**：修复规则 3 的冲突点，补齐主流编辑器习惯。

**How**：仅修改 if 条件与提取局部变量，不改动缩放数学。需要测试 macOS 上 Cmd+滚轮的 `e.metaKey` 是否正确触发。

### 改动 5：补齐 contenteditable 焦点判断

**文件**：[use-modifier-keys.ts](file:///c:/worker/nebula/apps/web/src/features/screen/hooks/use-modifier-keys.ts)

**What**：
1. 新增工具函数 `isFormElementFocused()`：
   ```ts
   export function isFormElementFocused(): boolean {
     const el = document.activeElement;
     if (!el) return false;
     const tag = el.tagName.toLowerCase();
     return tag === 'input' || tag === 'textarea' || tag === 'select'
       || (el as HTMLElement).isContentEditable;
   }
   ```

2. 在 `useModifierKeys` 内部对 space 的 keydown callback 增加判断：当 `isFormElementFocused()` 为 true 时，不调用 preventDefault（让用户在 input 中正常输入空格）。

3. **不**改动 shift / alt / ctrl 的处理（它们本来就不 preventDefault）。

**Why**：修复规则 6 的隐患点；同时为未来自研 contenteditable 文本组件预留兼容性。

**How**：纯增量改动，不影响现有 input/textarea 的行为（react-hotkeys-hook 的 enableOnFormTags 已经处理了这些，但 use-modifier-keys 是独立 hook，需要单独判断）。

### 改动 6：spec.md 沉淀方法论与检查清单

**文件**：`.trae/specs/research-interaction-architecture/spec.md`

**What**：在 spec.md 末尾新增"快捷键防冲突方法论"小节，包含：
1. 5 条规则（与本文档第二节一致）
2. 新增快捷键检查清单（6 项 checkbox）
3. 列举本次修复的 7 类冲突及对应改动文件

**Why**：用户明确要求"提供方法论，尽量减少类似情况"，方法论必须文档化才能传承。

**How**：直接在 spec.md 末尾追加小节，不修改已有内容。

---

## 四、Assumptions & Decisions（假设与决策）

### 假设
1. `react-hotkeys-hook` 的 `preventDefault: true` option 在 keydown 阶段生效，能在事件冒泡前阻止浏览器默认行为（基于库文档）
2. macOS Safari/Chrome 上 Cmd+滚轮的 `e.metaKey` 会被正确设置（基于 Web 标准与浏览器一致性）
3. `import.meta.env.DEV` 在 Vite 开发模式下为 true，生产构建为 false 且 tree-shake 会移除校验代码
4. 现有 54 条 registry 条目的 scope 与 enableOnFormTags 配置是正确意图（除 Tab toggleUI 需调整）

### 决策
1. **不新建 window capture 拦截层**：用户明确选择"在现有 react-hotkeys-hook 框架内补齐"
2. **不接入 interaction-state-machine**：用户明确选择"不接入状态机"，避免本次工作膨胀到阶段 4
3. **Alt+方向键注册为 noop**：而非改写 nudge 逻辑支持 Alt 修饰，保持 nudge 语义纯净，只阻止浏览器历史导航
4. **`mod+=` 别名而非替换**：保留 `mod+=` 作为主键，新增 `mod+shift+=` 作为别名，兼容两种键盘布局
5. **Tab toggleUI 改为 `enabled: canvasEnabled`**：在文本编辑态、对话框打开时不触发，避免干扰焦点流转
6. **不修复预存 lint 警告**：与本阶段无关的 screen-canvas.tsx `e.datas` / `e.lastEvent` any 类型等问题不在本次范围

---

## 五、Verification Steps（验证步骤）

### 5.1 自动化验证

```bash
# 类型检查
pnpm typecheck

# Lint
pnpm lint

# Biome 格式化
pnpm exec biome check --write apps/web/src/features/screen

# 单元测试（重点跑 shortcuts-registry 与 use-keyboard-shortcuts 相关测试）
pnpm --filter @nebula/web test
```

**预期**：
- typecheck 0 错误
- biome 0 错误
- 现有 253 个单测全通过
- 新增 `validateRegistry` 单测全通过（建议补 5-8 个测试用例）

### 5.2 新增单测

**文件**：`apps/web/src/features/screen/hooks/shortcuts-registry.test.ts`（新增）

测试用例：
1. `validateRegistry` 对 `browserConflict: 'overridable'` + `preventDefault: 'none'` 报警告
2. `validateRegistry` 对 `browserConflict: 'reserved'` 报警告
3. `validateRegistry` 对合规条目不报警告
4. SHORTCUTS_REGISTRY 中所有 `browserConflict: 'overridable'` 条目都有 `preventDefault !== 'none'`
5. SHORTCUTS_REGISTRY 中所有条目都有 `preventDefault` 与 `browserConflict` 字段
6. `buildHotkeysOptions` 对 `preventDefault: 'always'` 返回 `preventDefault: true`
7. `buildHotkeysOptions` 对 `preventDefault: 'callback-only'` / `'none'` 返回 `preventDefault: false`
8. `buildHotkeysOptions` 对 `scope: 'global'` 默认 `enableOnFormTags: true`

### 5.3 手工回归测试清单

在浏览器中打开 screen editor，依次验证：

```
[ ] 1. 选中组件后按方向键，组件移动且页面不滚动
[ ] 2. 选中组件后按 Shift+方向键，组件大步移动且页面不滚动
[ ] 3. 在画布空白处按 Alt+Left/Right，不触发浏览器历史后退/前进
[ ] 4. 在画布上 Ctrl/Cmd+滚轮，画布缩放且浏览器不缩放
[ ] 5. 在画布上 Alt+滚轮，画布缩放（原有行为不回归）
[ ] 6. 按 Ctrl/Cmd+L，不触发浏览器地址栏聚焦（lock 功能正常）
[ ] 7. 按 Ctrl/Cmd+H，不触发浏览器历史面板（hide 功能正常）
[ ] 8. 按 Ctrl/Cmd+K，不触发 Firefox 搜索栏（toggleBorderGuides 功能正常）
[ ] 9. 焦点在 Radix Popover 按钮上时按 Tab，不触发 toggleUI（焦点正常流转）
[ ] 10. 焦点在 input 中按 Tab，焦点切换到下一个 input（不触发 toggleUI）
[ ] 11. 焦点在 input 中按 Space，能正常输入空格（不触发平移）
[ ] 12. 焦点在 contenteditable 元素中按 Space，能正常输入空格
[ ] 13. 按 Ctrl/Cmd+= 和 Ctrl/Cmd+Shift+= 都能放大画布
[ ] 14. 按 Ctrl/Cmd+- 缩小画布，浏览器不缩放
[ ] 15. 按 Ctrl/Cmd+0 适应屏幕，浏览器不重置缩放
[ ] 16. 按 Ctrl/Cmd+S 保存，浏览器不弹保存对话框
[ ] 17. 按 Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z 撤销/重做，浏览器历史不变化
[ ] 18. 开发模式下打开 console，无 shortcuts-registry 防冲突校验警告
```

### 5.4 方法论生效验证

新增一个测试快捷键（如 `mod+shift+f` 全屏切换），故意不填 `preventDefault` 字段：
```
[ ] TypeScript 报错（因为字段是必填）
[ ] 补一个 `preventDefault: 'none'` + `browserConflict: 'overridable'` 的条目，console 出现校验警告
[ ] 改为 `preventDefault: 'always'`，警告消失
```
（验证完成后删除测试条目）

---

## 六、任务拆分建议（供后续执行参考）

| # | 任务 | 复杂度 | 依赖 |
|---|---|---|---|
| 1 | 扩展 ShortcutEntry 类型与补齐 54 条字段 | 中 | 无 |
| 2 | 新增 validateRegistry + 单测 | 小 | 1 |
| 3 | 新增 buildHotkeysOptions helper + 单测 | 小 | 1 |
| 4 | 重构 use-keyboard-shortcuts 调用方式 | 中 | 1, 3 |
| 5 | 修复 Tab toggleUI enabled 范围 | 小 | 4 |
| 6 | 新增 Alt+方向键 noop 条目 | 小 | 1 |
| 7 | 为 zoomIn 增加 mod+shift+= 别名 | 小 | 4 |
| 8 | 扩展 wheel 处理覆盖 Ctrl/Cmd+滚轮 | 小 | 无 |
| 9 | 新增 isFormElementFocused + 集成到 use-modifier-keys | 小 | 无 |
| 10 | spec.md 沉淀方法论与检查清单 | 小 | 全部完成 |
| 11 | 整体验证（typecheck + lint + biome + test + 手工回归） | 中 | 全部完成 |

**总计**：11 个原子任务，每个 1-2 小时，符合项目小步快迭代方法论。

---

## 七、Out of Scope（明确不在本次范围）

- 接入 interaction-state-machine（属于阶段 4）
- 替换 react-hotkeys-hook（不必要）
- 新建 window 级 capture 拦截层（与用户决策冲突）
- 修复预存 lint 警告（screen-canvas.tsx 的 `e.datas` any、property-panel.tsx 的 `JSON.parse` any 等，与本阶段无关）
- 浏览器保留键（F5、Ctrl+W、Ctrl+N、F12 等）的拦截（JS 无法拦截）
- 修改 shortcuts-help-dialog 的展示逻辑（自动从 registry 读取，无需改动）
