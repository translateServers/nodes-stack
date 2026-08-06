# 组件作者与宿主注册指南

> 状态：生效中
> 最近更新：2026-08-03
> 定位：面向外部组件作者和 SDK 宿主，记录当前已实现的 0.2 组件注册基线
> 迁移边界：本文中的 manifest、事件 detail 和 `<nebula-screen-editor>` 仅描述当前实现；新增契约或
> React/Vue bridge 必须以 [统一组件契约与框架桥接 Spec](../screen-component-framework-bridges/spec.md) 为准，
> BUS-5 完成后再由目标契约重写本文

## 1. 组件作者最小实现

组件包只依赖 `@nebula/screen-component-sdk`，不依赖编辑器 core、React、路由、请求库或宿主应用代码。

```ts
import {
  SCREEN_COMPONENT_API_VERSION,
  type ScreenComponentElementModel,
  type ScreenComponentManifest,
  type ScreenComponentPlugin,
} from '@nebula/screen-component-sdk';

class MetricCardElement extends HTMLElement {
  set model(model: ScreenComponentElementModel) {
    const title = typeof model.props.title === 'string' ? model.props.title : 'Metric';
    const value = typeof model.props.value === 'number' ? model.props.value : 0;
    this.textContent = `${title}: ${value}`;
  }
}

export const metricCardManifest: ScreenComponentManifest = {
  apiVersion: SCREEN_COMPONENT_API_VERSION,
  type: 'acme.metric-card/v1',
  implementationVersion: '1.0.0',
  tagName: 'acme-metric-card-v1',
  name: 'Metric Card',
  category: 'chart',
  defaultSize: { width: 240, height: 120 },
  defaultProps: { title: 'Revenue', value: 42 },
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      value: { type: 'number' },
    },
    required: ['title', 'value'],
  },
  propertyPanel: [
    {
      id: 'metric-card-basic',
      title: 'Metric Card',
      fields: [
        { id: 'title', label: 'Title', pointer: '/title', control: 'text' },
        { id: 'value', label: 'Value', pointer: '/value', control: 'number' },
      ],
    },
  ],
  events: [{ id: 'valueClick', name: 'Value Click' }],
};

export const metricCardPlugin: ScreenComponentPlugin = {
  manifest: metricCardManifest,
  define: () => MetricCardElement,
};
```

组件通过 `model` property 接收 detached snapshot。不要读取编辑器 Store、Adapter、Router、QueryClient、Token 或 Cookie。

`define()` 只返回稳定的构造器引用，不能自行调用 `customElements.define()`。registry factory 会在所有 manifest、重复项和构造器都通过校验后统一注册 Custom Element；组件包需要让重复调用 `define()` 返回同一个构造器。

## 2. 派发标准事件

组件只能派发 manifest 声明过的 `nebula-component-event`。SDK 使用 renderer 上下文里的可信 component id，不信任事件 detail 中的 component id。

```ts
this.dispatchEvent(
  new CustomEvent('nebula-component-event', {
    bubbles: true,
    composed: true,
    detail: {
      eventId: 'valueClick',
      payload: { value: 42 },
    },
  }),
);
```

payload 必须是 JSON value，且大小受 SDK 限制。非法事件、非法 payload 或 `interactive=false` 时事件会被忽略。

## 3. 宿主注册

宿主从 `@nebula/screen-sdk/components` 创建 registry，并在首次 load 前赋给 element property：

```ts
import '@nebula/screen-sdk/auto-register';
import type { NebulaScreenEditorElement } from '@nebula/screen-sdk';
import {
  createScreenComponentRegistry,
  type ScreenHostAdapter,
} from '@nebula/screen-sdk/components';
import { metricCardPlugin } from './metric-card';

const componentRegistry = await createScreenComponentRegistry({
  // 不传时保留全部内置组件；可改为 ['text', 'bar-chart'] 或 []。
  builtInComponents: ['text', 'bar-chart'],
  components: [metricCardPlugin],
});

const adapter: ScreenHostAdapter = {
  loadProject: async ({ projectId }) => loadProject(projectId),
  saveProject: async ({ projectId, draft, revision }) => saveProject(projectId, draft, revision),
};

const editor = document.createElement('nebula-screen-editor') as NebulaScreenEditorElement;
editor.componentRegistry = componentRegistry;
editor.adapter = adapter;
editor.projectId = 'screen-1';
document.body.append(editor);
```

React 和 Vue 宿主必须通过 ref 设置 property，示例见 [0.2 迁移指南](./migration-0.2.md)。

`componentRegistry` 必须是 `createScreenComponentRegistry()` 返回的 facade。Element 不接受手写的 `{ size, get, has, list }` 对象；项目加载前会以 `VALIDATION` 拒绝，避免绕过 manifest、constructor 和不可变快照校验。

`builtInComponents` 是宿主级白名单：未设置时加载全部六个内置组件，空数组时不加载内置组件。未加载的内置 type 不会出现在组件库，且引用它的文档会在 registry-aware 校验时被拒绝。

## 4. 安全边界

- 文档不能加载脚本、模块 URL、构造函数或任意 HTML。
- manifest icon 只接受 SDK token，不接受 SVG/HTML 字符串。
- 外部组件不支持 `dataSource`、`logic`、`interaction` 或自定义 action。
- Shadow DOM 只隔离样式，不是安全沙箱。
- 外部组件代码是受信任代码，应由宿主显式导入并注册。
- 缺少组件定义、props 不合法或能力不支持时 fail-closed，不覆盖当前项目。
- props、静态数据和全局变量只接受 JSON 值：不接受 `undefined`、`NaN`、`Infinity`、function、class instance、DOM Node、Promise、循环引用或 prototype pollution key。

## 5. 验证命令

```bash
pnpm --filter @nebula/screen-component-sdk typecheck
pnpm --filter @nebula/screen-component-sdk lint
pnpm --filter @nebula/screen-component-sdk test
pnpm --filter @nebula/screen-sdk verify:tarball
```

`verify:tarball` 覆盖 Vanilla registry、React ref 赋值和 Vue ref 赋值的构建 smoke。
