# ADR-0001: 大屏 SDK 静态 Runtime 边界与组合方式

> 状态：已替代
> 日期：2026-07-31
> 定位：确定 Web Component SDK、编辑器共享核心与 Nebula Web 动态能力的源码边界和依赖方向
> 替代：由 [ADR-0003](./ADR-0003-screen-unified-contract-framework-bridges.md) 统一 component/document/data/SDK 契约

## 背景

大屏 Web Component SDK V1 只支持 static 数据源，不应包含或执行 API/dataset 数据请求、`requestApi` 蓝图动作、Nebula Router/Query/Axios、认证和全局通知实现。

阶段 6 的临时实现通过 Vite virtual bridge 从 `apps/web` 编译 `ScreenEditorWorkbench`。虽然 static capability profile 会在加载和 UI 层拒绝动态能力，但生产 SDK 产物仍然会带入动态数据 hooks、Axios、Sonner 样式和其他应用源码，源码边界检查也无法覆盖这条生产构建路径。

约束如下：

- 不公开 V1 的自定义组件、属性面板或蓝图插件 API。
- 不长期维护两份 Store、画布交互逻辑或 Workbench。
- `apps/web` 的现有动态项目和生产入口在迁移完成前保持不变。
- SDK tarball 必须是可被 Vanilla 宿主直接消费的自包含 ESM 包。

## 考虑的方案

### 方案 A：私有编辑器核心 + 静态/动态 Runtime 组合

新增私有 workspace 包 `@nebula/screen-editor-core`，承载 Store、画布、历史栈、快捷键、Workbench 基础布局、Portal/实例隔离和不含业务请求的编辑器公共能力。

```text
packages/shared
       ↓
packages/screen-editor-core   private workspace package
       ↓                  ↓
packages/screen-sdk       apps/web
static runtime            dynamic runtime + Nebula host
```

`packages/screen-sdk` 只组装 static profile 和 Web Component；`apps/web` 基于同一 core 组装 API/dataset 能力和 Nebula 宿主能力。两者通过内部类型化 runtime profile 组合，不对外形成 V1 插件 API。

优点：

- SDK 的生产依赖图从根上排除 `apps/web` 动态能力。
- Store、画布和 Workbench 只有一份实现。
- 动态 Web 编辑器仍可继续使用 API/dataset 能力。
- static/dynamic 能力边界由构建入口和类型组合共同保证。

缺点：

- 需要一次跨包迁移，涉及编辑器公共模块的目录和 import 调整。
- 需要设计内部 runtime profile 接口，并为两种组装方式补集成测试。

### 方案 B：继续使用 virtual bridge 编译 `apps/web`

SDK 继续通过 Vite 插件把 `apps/web` 的 Workbench 编译进 SDK，依靠 static profile 在运行时隐藏和拒绝动态能力。

优点：

- 当前代码改动最少。
- 不需要立即拆分编辑器公共模块。

缺点：

- SDK 产物继续携带动态数据和应用依赖。
- `packages/screen-sdk` 的源码边界与实际生产构建边界不一致。
- 未来新增动态功能可能绕过 static profile 进入 SDK。
- 依赖图和 tarball 只能通过脆弱的产物黑名单检查兜底。

结论：不接受，作为阶段 6 的临时迁移桥接，必须在架构落地时删除。

### 方案 C：依赖 Tree-shaking 或构建 alias 裁剪动态模块

通过构建条件、alias 或空实现替换 API/dataset 模块，尝试让 bundler 从 SDK 产物中移除动态代码。

优点：

- 表面上不需要新增 workspace 包。
- 可能减少部分短期迁移工作。

缺点：

- 依赖 bundler 对动态导入、条件分支和副作用的判断，结果不稳定。
- 容易产生“编辑器能加载，但某个操作运行时崩溃”的半静态产物。
- 不能建立清晰的源码所有权和长期依赖方向。

结论：不接受。

## 取舍分析

方案 A 的迁移成本高于保留 virtual bridge，但它是唯一同时满足以下要求的方案：

- SDK 不反向依赖 `apps/web`。
- SDK static runtime 不携带动态业务能力。
- Nebula Web 动态能力不被删除或静默降级。
- Store、画布和 Workbench 不发生长期双份维护。

`@nebula/screen-editor-core` 是私有 workspace 包，不作为 SDK 的公共插件扩展面；SDK 构建时将 core 打入自身 ESM 产物，消费者不需要安装或解析 core 源码。

内部组合接口建议采用具体的 profile 对象，而不是只传递 `'static' | 'dynamic'` 标志：

```ts
interface ScreenEditorRuntimeProfile {
  componentRegistry: ComponentRegistry;
  propertySchemas: PropertySchemaRegistry;
  dataRuntime: DataRuntime;
  blueprintCapabilities: BlueprintCapabilities;
  notifications: NotificationPort;
}
```

static profile 只能引用 static registry、static data parser 和白名单蓝图执行器；dynamic profile 由 `apps/web` 注入 API/dataset 执行能力。该接口保持 workspace 内部，不加入 V1 公共 exports。

## 结论

最终选择：**方案 A，私有编辑器核心 + 静态/动态 Runtime 组合。**

依赖方向必须满足：

```text
shared → screen-editor-core → screen-sdk
                         ↘ apps/web
```

禁止：

- `packages/screen-sdk` 或 `screen-editor-core` import `apps/web` 源码。
- SDK runtime 引入 API/dataset hooks、Axios、Sonner、TanStack Router/Query 或 Nebula auth store。
- 通过公开 plugin API 让宿主注入 V1 renderer、属性面板或蓝图节点。
- 在 static runtime 中执行业务 `fetch`。

## 影响

- 新增私有包 `@nebula/screen-editor-core`，并将公共编辑器模块迁移到该包。
- `packages/screen-sdk` 新增独立 static runtime entry，移除 Vite virtual runtime bridge。
- `apps/web` 保留动态 runtime、Nebula Host Adapter、路由、认证、API/dataset 和现有生产入口。
- 阶段 6 在静态 runtime 迁移完成前保持“整改中”，不切换现有动态项目入口。
- SDK 构建必须增加产物依赖图门禁，至少拒绝 `apps/web`、API/dataset hooks、Axios、Sonner、TanStack Router/Query 和直接业务 `fetch`。
- 迁移完成后必须重新执行 Vanilla 宿主 E2E、双实例隔离、空白项目 tarball 安装构建，以及当前稳定版 Chrome/Edge 冒烟验证。

> 落地记录（2026-07-31）：方案 A 已实施并通过阶段 6 定向验证——`@nebula/screen-editor-core` 创建完成，SDK static runtime entry 与 `apps/web` dynamic profile 分别组装，virtual runtime bridge 删除；源码 AST 检查 + dist sourcemap module graph 门禁挂入 build，tarball 空白消费项目 install/typecheck/build 通过。Vanilla 宿主 E2E 与 Chrome/Edge 冒烟随阶段 7-8 执行。
