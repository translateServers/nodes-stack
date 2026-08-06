# 大屏设计器功能点清单 · 复核差距报告

> 复核对象：`docs/analysis/screen-designer-feature-inventory.md`（2026-08-05 版）
> 复核方式：逐文件对照代码库 `packages/screen-*` + `apps/web/src/features/screen`
> 结论：**不完整**。对 `screen-editor-core` 覆盖极细；对三个兄弟 SDK 包存在系统性遗漏，最严重的是 `screen-dynamic-sdk` 整包缺失。
>
> **状态：已修复（2026-08-05）。** 原文档已补 §19.9（props.data 迁移）、§21.10（导入控制端口）、§33（screen-dynamic-sdk）、§34（screen-sdk）、§35（screen-component-sdk），范围行与 §36 文件索引同步更新。本文件仅作修复前的复核留档。

---

## 一、范围声明与实际不一致（先说结论）

文档第 5 行声明范围：

```
packages/screen-editor-core + packages/screen-sdk + packages/screen-component-sdk + apps/web/src/features/screen
```

但代码库实际有 **4 个 screen 包**，文档漏列了 `packages/screen-dynamic-sdk`。且对声明的 `screen-sdk`、`screen-component-sdk` 也只各提了 2 次（均非功能盘点），并未真正盘点。

| 包 | 文档提及次数（关键词命中） | 是否有独立功能章节 | 判定 |
|---|---:|---|---|
| `screen-editor-core` | 大量 | 有（§1–§29） | ✅ 覆盖充分 |
| `apps/web/src/features/screen` | 多 | 有（§20） | ✅ 基本覆盖 |
| `screen-sdk` | 2（范围行 + 面板宽度 namespace） | ❌ | ⚠️ 未盘点 |
| `screen-component-sdk` | 2（范围行 + §18.5 manifest） | ❌ | ⚠️ 未盘点 |
| `screen-dynamic-sdk` | **0** | ❌ | ❌ 完全缺失 |

---

## 二、重大遗漏 1：`packages/screen-dynamic-sdk`（整包 0 提及）

这是最大的缺口。该包是一套**独立的动态设计器 / 查看器 Web Component 交付物**，属于大屏设计器产品家族，但文档 §19 只讲了"动态数据层"（`src/dynamic/` + `dynamic-document.ts`），未把这套动态 designer/viewer 交付物作为功能域覆盖。

应补充的功能点（依据 `packages/screen-dynamic-sdk/src/`）：

### 2.1 动态设计器 Web Component `<nebula-screen-designer>`
- 文件：`element/nebula-screen-designer-element.ts`
- 属性：`document`（V3 动态文档，读写深拷贝）、`dataAdapter`、`componentRegistry`（挂载后冻结）、`options`/`readonly`/`theme`
- 方法：`whenReady` / `save` / `publish` / `getDocument` / `undo` / `redo` / `validate` / `reload`
- 事件：`nebula-ready` / `nebula-error` / `nebula-dirty-change` / `nebula-save-success` / `nebula-publish-success`

### 2.2 动态查看器 Web Component `<nebula-screen-viewer>`
- 文件：`element/nebula-screen-viewer-element.ts`
- 属性：`document`、`dataAdapter`（必填）、`componentRegistry`、`options.refreshIntervalSeconds`（定时刷新，0=不刷新）、`theme`
- 方法：`whenReady` / `reload` / `getDocument`
- 事件：`nebula-ready` / `nebula-error` / `nebula-data-error`

### 2.3 动态设计器工作台 `designer-workbench.tsx`
- 画布渲染与 viewer 同源（绝对定位 + fit 缩放）
- 支持选择、拖拽移动、右下角缩放手柄
- 设计态组件以 placeholder 渲染（`mode='design'`、无数据执行）
- 保存/发布语义由宿主决定；工作台只负责文档状态与校验

### 2.4 动态查看器工作台 `viewer-workbench.tsx`
- 全屏画布 + fit 等比缩放
- 打开数据执行上下文，执行全部 host/xj-metric 组件
- 定时刷新（`refreshIntervalSeconds`）
- 复用 editor-core 的 `CustomElementRenderer`（`mode='viewer'`、model v2）
- 不提供任何编辑命令 / 设计选框 / `requestApi`

### 2.5 运行时与基础
- `runtime/designer-runtime.tsx`、`runtime/viewer-runtime.tsx`（挂载运行时）
- `element/base-element.ts`（`ScreenDynamicElementBase`）
- `bundle-entry.ts`、`auto-register.ts`
- `testing/fake-data-adapter.ts`（测试替身）

### 2.6 契约切片组件 `contract-components/`
- `xj-chart-bar.ts`（`xj.chart.bar/v1`）、`xj-metric-card.ts`（`xj.metric-card/v1`）
- 验证组件 API v2 契约（`dataCapability=host-metric`）与 model v2 `dataState` 闭环；真实 XJ 组件在 A2 实现（属 fixture，可标注为契约自测）

### 2.7 关联遗漏：`screen-editor-core/src/experimental.ts`
- dynamic-sdk 通过 `@nebula/screen-editor-core/experimental` 消费 `CustomElementRenderer`、`ScreenComponentInstanceRegistry`。
- 该"实验性导出面"在文档中 0 提及，建议在 §19 或新增"动态 SDK 桥接"节说明。

---

## 三、重大遗漏 2：`packages/screen-sdk`（仅 2 次 incidental 提及）

该包把编辑器本身打包成可嵌入的 Web Component（独立交付通道），但文档从未把它作为功能域盘点。

应补充（`packages/screen-sdk/src/`）：
- `<nebula-screen-editor>` Custom Element：`element/nebula-screen-editor-element.ts`
- 元素运行时：`element/runtime.ts`、`element/runtime-loader.ts`、`element/define.ts`、`element/contracts.ts`
- 静态运行时：`runtime/static-runtime.tsx`
- 主题与样式：`styles/theme.ts`、`styles/install-styles.ts`
- 自动注册：`auto-register.ts`

（文档里 `screen-sdk` 仅出现在范围行与 §16.3 面板宽度 namespace 常量 `'nebula:screen-sdk:v1'`，属顺带提及。）

---

## 四、重大遗漏 3：`packages/screen-component-sdk`（仅 §18.5 覆盖 manifest）

该包是**组件扩展 SDK**（第三方如何开发出现在设计器组件库中的自定义组件），文档仅在 §18.5 提到 `contracts/manifest.ts`，整个扩展能力面未盘点。

应补充（`packages/screen-component-sdk/src/`）：
- 事件契约与桥：`contracts/event.ts`、`events/event-bridge.ts`
- Manifest 校验：`validation/manifest-validator.ts`
- 组件校验层：`validation/property-panel.ts`、`validation/props-schema.ts`、`validation/json-boundary.ts`、`validation/identity.ts`、`validation/events.ts`
- 插件契约：`contracts/plugin.ts`
- 其余契约：`contracts/property.ts`、`contracts/json.ts`、`contracts/model.ts`、`contracts/diagnostic.ts`
- 组件 API v2：`dynamic/data-capability.ts`、`dynamic/model-v2.ts`
- 工具：`props/json-pointer.ts`、`define.ts`、`testing.ts`

---

## 五、编辑器内核内（screen-editor-core）的次要遗漏

以下文件在代码中存在、实现明确，但文档未点名（多数为 §17/§24 等章节的内部支撑，影响程度较低）：

| 文件 | 功能 | 现状 |
|---|---|---|
| `lib/data-source-migration.ts` | 遗留 `props.data` 在首次经数据层 UI 提交时一次性迁移为数据层静态数据（与新建配置合并为一条历史） | 0 提及，建议补入 §19 数据层 |
| `components/quick-event-editor.tsx` | 属性面板"事件"区，点击打开**限定到当前组件**的蓝图 Sheet | 未点名，属 §17/§24 入口 |
| `lib/preferences-persist.ts` | 每实例偏好持久化（`snapEnabled`/`guidesVisible`/`interactionMode`，namespace 隔离 + 旧 key 迁移） | 效果在 §6.9/§16.3 提及，机制未点名 |
| `host/screen-import-controller-port.ts` | 宿主侧导入端口（`prepareImport`/`importProject`） | §28.3/§21 覆盖导入，端口未点名 |
| `lib/image-file-adapter.ts` | 图片文件选择 → data URL（任务 7.3） | 属 image 工具/组件内部，影响低 |
| `src/experimental.ts` | 供 dynamic-sdk 消费的实验性导出面 | 见 §二.2.7 |

注：画布闪烁高亮 `canvas-flash-overlay.tsx` / `use-canvas-flash.ts` 实际上已在 §16.3（workbench 子元素 `<CanvasFlashOverlay>`）与 §17.18（`onLocateComponent`）提及，不算遗漏。

---

## 六、建议

1. **补三章**盘点 `screen-dynamic-sdk`、`screen-sdk`、`screen-component-sdk`，并将 `screen-dynamic-sdk` 补进文档"范围"声明。
2. **动态 designer/viewer** 建议单列一节（§33 动态设计器/查看器交付物），与 §19 动态数据层区分开。
3. **次要遗漏**并入对应章节（数据层迁移入 §19、偏好持久化机制入 §6/§16）。
4. 文档开头"范围"声明建议改为实际覆盖的 4 个包，避免"全量"与实际不符。

---

_复核基于代码库 `packages/screen-editor-core`(447 源文件)、`screen-sdk`、`screen-component-sdk`、`screen-dynamic-sdk` 及 `apps/web/src/features/screen` 的文件清单与头部注释；关键词命中数来自对原文档的全文 grep。_
