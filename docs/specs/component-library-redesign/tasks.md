# Tasks

## 阶段 1：统一注册接口与索引化（核心基础）

- [x] Task 1: 设计 `ComponentModule` 类型与 `registerComponent` API
  - [x] 在 `registry/types.ts` 定义 `ComponentModule` 接口（`{ definition, renderer, schema?, icon? }`）
  - [x] 在 `registry/registry.ts` 实现 `registerComponent(module)` 与 `getDefinitionByType` 的 Map 索引
  - [x] 实现 `COMPONENT_DEFINITIONS` / `RENDERERS` / `ICON_MAP` / `PROPERTY_SCHEMAS` 从注册表派生
  - [x] 实现重复注册检测（dev 模式 throw，prod 静默覆盖）
  - [x] 编写 registry.test.ts 单元测试覆盖注册、查找、重复检测
- [x] Task 2: 迁移 6 个现有组件到新接口
  - [x] 在每个组件文件（`text-component.tsx` / `bar-chart-component.tsx` / `rect-component.tsx` / `ellipse-component.tsx` / `image-component.tsx` / `button-component.tsx`）末尾 `export default` 一个 `ComponentModule`
  - [x] 创建 `registry/registered-components.ts` 集中调用 `registerComponent` 导入所有 6 个模块
  - [x] 删除 `registry/index.ts` 中手动的 `COMPONENT_DEFINITIONS` 数组与 `RENDERERS` map
  - [x] 保留 `registry/index.ts` 作为 re-export 入口，导出 `getDefinitionByType` / `getDefinitionsByCategory` / `searchComponentDefinitions` / `createComponentInstance` / `CATEGORY_META`
  - [x] 更新 `registry/icons.ts`：`ICON_MAP` 从注册表派生，`KNOWN_TYPE_TO_ICON` 保留作为兜底
  - [x] 更新 `property-schema/schemas.tsx`：`PROPERTY_SCHEMAS` 从注册表派生
  - [x] 运行 `pnpm --filter @nebula/web typecheck` 与 `pnpm --filter @nebula/web lint` 验证
- [x] Task 3: 验证现有测试通过
  - [x] 运行 `pnpm --filter @nebula/web exec vitest run src/features/screen/registry src/features/screen/property-schema`
  - [x] 更新 registry.test.ts 中「6 条定义」数量断言为从派生表读取
  - [x] 确认 icons.test.ts 的 `def.icon` 必须在 `ICON_MAP` 中存在的契约测试仍通过
  - [x] 确认 button-component.test.tsx 等 6 个组件渲染测试仍通过

## 阶段 2：Category 元数据集中化

- [x] Task 4: 创建 `CATEGORY_META` 并迁移 `CATEGORY_LABELS`
  - [x] 在 `registry/category-meta.ts` 定义 `CATEGORY_META: Record<category, { label, icon, order, description? }>`
  - [x] 包含现有 6 个 category：`chart / text / media / decoration / table / container`
  - [x] 为每个 category 分配 lucide 图标（chart→BarChart3、text→Type、media→Image、decoration→Frame、table→Table、container→Box）
  - [x] 删除 `registry/index.ts` 中的 `CATEGORY_LABELS`，改为从 `CATEGORY_META` re-export `categoryLabel(cat)` 辅助函数
  - [x] 更新 `component-library.tsx` 中 `CATEGORY_LABELS[category]` 引用为 `categoryLabel(category)`
  - [x] 编写 category-meta.test.ts 验证：所有 category 有 label + icon + order
- [x] Task 5: 实现分类分区折叠能力
  - [x] 在 `component-library.tsx` 中为每个 `<PanelSection>` 传入 `collapsible` prop
  - [x] 使用 `resetKey` + `defaultOpen` 状态维护折叠状态（通过强制 PanelSection 重新挂载应用新 defaultOpen）
  - [x] 在分区标题栏添加展开/折叠图标（PanelSection 内部 ChevronDown 旋转）
  - [x] 添加「折叠全部 / 展开全部」按钮（位于搜索框下方、收藏分区之上）
  - [x] 编写 component-library.test.tsx 验证折叠/展开交互（通过 resetKey 机制实现）

## 阶段 3：收藏机制

- [x] Task 6: 创建 `favorite-components.ts` 存储
  - [x] 仿照 `recent-components.ts` 结构，localStorage key: `nebula:favorite-components`
  - [x] 结构：`Record<type, { type, favoritedAt }>`
  - [x] 实现 `toggleFavorite(type)` / `isFavorite(type)` / `getFavoriteComponents()` / `clearFavorites()`
  - [x] 派发 `favorite-components:updated` 事件
  - [x] 监听 `window focus` 事件刷新（跨 tab 同步）
  - [x] 编写 favorite-components.test.ts 覆盖增删查、事件派发、上限
- [x] Task 7: 在组件库 UI 接入收藏
  - [x] 在 `component-library.tsx` 顶部新增「收藏」PanelSection（位于搜索框下方、最近使用之上）
  - [x] 仅当 `favorites.length > 0` 且 `keyword.trim() === ''` 时显示
  - [x] 在 `ComponentLibraryItem` 右侧新增 star 按钮（hover 显示，已收藏时高亮常显）
  - [x] star 按钮点击调用 `toggleFavorite(type)` 并阻止拖拽事件传播
  - [x] star 按钮加 `aria-label="收藏"` / `aria-pressed={isFavorite}` 无障碍属性
  - [x] 编写 component-library.test.tsx 验证：收藏分区显示/隐藏、star 按钮切换、搜索时隐藏

## 阶段 4：搜索优化

- [x] Task 8: 搜索 debounce 与相关度排序
  - [x] 在 `component-library.tsx` 中用 `useState` + `useEffect` 实现 200ms debounce（替代直接 `useMemo`）
  - [x] 在 `searchComponentDefinitions` 中实现相关度评分：名称完全匹配=4、名称前缀=3、名称包含=2、keywords 包含=1
  - [x] 搜索结果按评分降序排序，同分按 `order` 升序
  - [x] 编写 search.test.ts 验证：debounce 触发次数、相关度排序顺序
- [x] Task 9: 调整最近使用上限为可配置
  - [x] 在 `recent-components.ts` 中导出 `DEFAULT_RECENT_LIMIT = 8`（原为 5）
  - [x] `component-library.tsx` 中 `RECENT_LIMIT` 引用 `DEFAULT_RECENT_LIMIT`
  - [x] `getRecentComponents(limit)` 已支持参数，无需改动 API
  - [x] 更新 recent-components.test.ts 中相关断言

## 阶段 5：最终验证

- [x] Task 10: 全量质量门验证
  - [x] 运行 `pnpm typecheck`（4/4 task 通过）
  - [x] 运行 `pnpm lint`（3/3 task 通过）
  - [x] 运行 `pnpm biome:check`（674 文件通过）
  - [x] 运行 `pnpm --filter @nebula/web exec vitest run src/features/screen`（107 文件，2274 passed，14 skipped）
  - [x] 修复 property-panel 测试回归：在 `property-schema/index.ts` 添加 `import '../registry/registered-components'` 确保注册在 schema 查询前完成

# Task Dependencies

- Task 2 依赖 Task 1（迁移前需先有 registerComponent API）
- Task 3 依赖 Task 2（验证需在迁移完成后）
- Task 4 可与 Task 1-3 并行（Category 元数据集中化与注册接口解耦）
- Task 5 依赖 Task 4（折叠分区使用 CATEGORY_META 的 label）
- Task 6 可与 Task 1-5 并行（收藏存储与注册接口解耦）
- Task 7 依赖 Task 6（UI 接入需先有收藏存储 API）
- Task 8 可与 Task 4-7 并行（搜索优化与折叠/收藏解耦）
- Task 9 可与 Task 1-8 并行（最近使用上限调整独立）
- Task 10 依赖所有其他 Task 完成
