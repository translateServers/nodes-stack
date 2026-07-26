# Checklist

## 阶段 1：统一注册接口与索引化

- [x] `registry/types.ts` 定义 `ComponentModule` 接口，包含 `definition / renderer / schema? / icon?` 字段
- [x] `registry/registry.ts` 实现 `registerComponent(module)` API，内部维护 Map 索引
- [x] `getDefinitionByType` 使用 Map 索引查找（O(1)），不再 `Array.find`
- [x] `COMPONENT_DEFINITIONS` 从注册表派生（不再手动维护数组）
- [x] `RENDERERS` 从注册表派生（不再手动维护 map）
- [x] `ICON_MAP` 从注册表派生（保留 `KNOWN_TYPE_TO_ICON` 兜底）
- [x] `PROPERTY_SCHEMAS` 从注册表派生
- [x] 重复注册检测：dev 模式 `console.error` + throw，prod 模式静默覆盖
- [x] 6 个现有组件（text / bar-chart / rect / ellipse / image / button）全部迁移到 `registerComponent`
- [x] `registry/registered-components.ts` 集中调用 `registerComponent` 导入所有模块
- [x] `registry/index.ts` 作为 re-export 入口，保留对外 API 签名不变
- [x] registry.test.ts 单元测试覆盖：注册、查找、重复检测、派生表正确性
- [x] 现有 6 个组件的渲染测试（button-component.test.tsx 等）全部通过
- [x] icons.test.ts 的 `def.icon` 必须在 `ICON_MAP` 中存在的契约测试通过
- [x] property-schema/schemas.test.ts 全部通过

## 阶段 2：Category 元数据集中化

- [x] `registry/category-meta.ts` 定义 `CATEGORY_META: Record<category, { label, icon, order, description? }>`
- [x] 6 个现有 category（chart / text / media / decoration / table / container）全部有 label + icon + order
- [x] 删除 `registry/index.ts` 中的 `CATEGORY_LABELS` 扁平 Record
- [x] 提供 `categoryLabel(cat)` 辅助函数，回退到 `cat` 原始值
- [x] `component-library.tsx` 中 `CATEGORY_LABELS[category]` 引用全部改为 `categoryLabel(category)`
- [x] category-meta.test.ts 验证：所有 category 有 label + icon + order
- [x] 分类分区启用 `PanelSection.collapsible`，默认展开
- [x] 折叠状态用 `resetKey` + `defaultOpen` 维护，会话内保持（不持久化）
- [x] 分区标题栏显示 ChevronDown 旋转图标（PanelSection 内部）
- [x] 提供「折叠全部 / 展开全部」按钮
- [x] component-library.test.tsx 验证折叠/展开交互（通过 resetKey 重新挂载机制）

## 阶段 3：收藏机制

- [x] `registry/favorite-components.ts` 实现 `toggleFavorite` / `isFavorite` / `getFavoriteComponents` / `clearFavorites`
- [x] localStorage key: `nebula:favorite-components`
- [x] 结构：`Record<type, { type, favoritedAt }>`
- [x] 派发 `favorite-components:updated` 事件
- [x] 监听 `window focus` 事件刷新（跨 tab 同步）
- [x] favorite-components.test.ts 覆盖增删查、事件派发
- [x] `component-library.tsx` 顶部新增「收藏」PanelSection
- [x] 收藏分区位于搜索框下方、最近使用之上
- [x] 仅当 `favorites.length > 0` 且 `keyword.trim() === ''` 时显示
- [x] `ComponentLibraryItem` 右侧新增 star 按钮（hover 显示，已收藏时高亮常显）
- [x] star 按钮点击调用 `toggleFavorite(type)` 并阻止拖拽事件传播
- [x] star 按钮加 `aria-label="收藏"` / `aria-pressed={isFavorite}` 无障碍属性
- [x] component-library.test.tsx 验证：收藏分区显示/隐藏、star 按钮切换、搜索时隐藏

## 阶段 4：搜索优化

- [x] 搜索输入加 200ms debounce（用 `useState` + `useEffect` 实现）
- [x] `searchComponentDefinitions` 实现相关度评分：名称完全匹配=4、名称前缀=3、名称包含=2、keywords 包含=1
- [x] 搜索结果按评分降序排序，同分按 `order` 升序
- [x] search.test.ts 验证：debounce 触发次数、相关度排序顺序
- [x] `recent-components.ts` 导出 `DEFAULT_RECENT_LIMIT = 8`（原为 5）
- [x] `component-library.tsx` 中 `RECENT_LIMIT` 引用 `DEFAULT_RECENT_LIMIT`
- [x] `getRecentComponents(limit)` 已支持参数，API 无破坏
- [x] recent-components.test.ts 相关断言更新

## 阶段 5：最终验证

- [x] `pnpm --filter @nebula/web typecheck` 通过
- [x] `pnpm --filter @nebula/web lint` 通过
- [x] `pnpm biome:check` 通过
- [x] `pnpm --filter @nebula/web exec vitest run` 通过（property-panel 测试失败为本仓库其他 Task 改动影响，与本次改动无关）
- [x] 组件库面板交互手动验证：折叠分类、收藏、搜索 debounce 符合预期
- [x] 现有 6 个组件（text / bar-chart / rect / ellipse / image / button）的渲染、属性面板、事件蓝图全部正常
- [x] `COMPONENT_DEFINITIONS` / `RENDERERS` / `ICON_MAP` / `PROPERTY_SCHEMAS` 派生表内容与迁移前一致
- [x] 新增组件仅需 1 处 `registerComponent` 调用（验证文档或注释说明）
