# Screen SDK 正式契约迁移指南

> 状态：生效中
> 最近更新：2026-08-02
> 定位：说明正式组件 registry、Host Adapter 与历史文档迁移边界

## 1. 结论

`<nebula-screen-editor>` 只使用正式 `ScreenHostAdapter` 与正式 document。历史持久化记录会在受控 parser 中迁移，首次成功保存后写回正式 document。

外部组件是显式 opt-in 能力。宿主要满足以下条件：

- 从 `@nebula/screen-sdk/components` 创建 `componentRegistry`。
- 给 `<nebula-screen-editor>` 赋值 JavaScript-only `componentRegistry` property。
- 使用 `ScreenHostAdapter`。
- 在首次 load 开始前完成 `componentRegistry` 赋值。

## 2. 内置组件场景

继续只使用内置 `text / bar-chart / rect / ellipse / image / button` 时，仍使用相同的 `ScreenHostAdapter`：

```ts
import '@nebula/screen-sdk/auto-register';
import type { ScreenHostAdapter } from '@nebula/screen-sdk';

const adapter: ScreenHostAdapter = {
  loadProject: async ({ projectId }) => loadProject(projectId),
  saveProject: async ({ projectId, draft, revision }) => saveProject(projectId, draft, revision),
};

const editor = document.createElement('nebula-screen-editor');
editor.adapter = adapter;
editor.projectId = 'screen-1';
document.body.append(editor);
```

Adapter wire 输入与输出保持 `schemaVersion: 2`；内部持久化 document 不保存构造器、模块 URL 或版本别名。

## 3. 启用外部组件

外部组件以组件插件注册，文档只保存 `type` 和 JSON `props`，不保存 `tagName`、模块 URL、构造函数或脚本源码。

```ts
import '@nebula/screen-sdk/auto-register';
import type { NebulaScreenEditorElement } from '@nebula/screen-sdk';
import {
  createScreenComponentRegistry,
   type ScreenComponentPlugin,
   type ScreenHostAdapter,
} from '@nebula/screen-sdk/components';

class MetricCardElement extends HTMLElement {
  set model(value: unknown) {
    const model = value as { props?: { title?: string; value?: number } };
    this.textContent = `${model.props?.title ?? 'Metric'}: ${model.props?.value ?? 0}`;
  }
}

const metricCardPlugin: ScreenComponentPlugin = {
  manifest: {
    apiVersion: 'nebula.screen-component/v1',
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
  },
  define: () => MetricCardElement,
};

const componentRegistry = await createScreenComponentRegistry({
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

## 4. React 宿主

React 宿主通过 ref 设置 property，避免把 `componentRegistry` 当 attribute 传入：

```tsx
import { createElement, useEffect, useRef } from 'react';
import type { NebulaScreenEditorElement } from '@nebula/screen-sdk';

function ScreenEditorHost() {
  const editorRef = useRef<NebulaScreenEditorElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor === null) return;
    editor.componentRegistry = componentRegistry;
    editor.adapter = adapter;
    editor.projectId = 'screen-1';
  }, []);

  return createElement('nebula-screen-editor', { ref: editorRef });
}
```

## 5. Vue 宿主

Vue 宿主同样通过 template ref 或 render ref 设置 property：

```ts
import { defineComponent, h } from 'vue';
import type { NebulaScreenEditorElement } from '@nebula/screen-sdk';

export const ScreenEditorHost = defineComponent({
  mounted() {
    const editor = this.$refs['editor'] as NebulaScreenEditorElement | undefined;
    if (editor === undefined) return;
    editor.componentRegistry = componentRegistry;
    editor.adapter = adapter;
    editor.projectId = 'screen-1';
  },
  render() {
    return h('nebula-screen-editor', { ref: 'editor' });
  },
});
```

## 6. 兼容与失败边界

- `componentRegistry` 是 JavaScript-only property，不是 attribute。
- 首次 load 开始后 registry 会被冻结，替换会抛 `InvalidStateError`。
- 外部 registry 必须在首次 load 前设置，否则 Element 在 load 前失败，Adapter 不会被调用。
- document 缺少组件定义、props 不合法或引用未支持能力时 fail-closed，不覆盖当前项目。
- 外部组件不会收到 Token、Cookie、Adapter、Store、Router 或 QueryClient。
- Shadow DOM 是样式封装边界，不是安全沙箱。

## 7. 发布前验证

发布外部组件宿主前至少运行：

```bash
pnpm --filter @nebula/screen-sdk verify:tarball
pnpm --filter @nebula/screen-sdk typecheck
pnpm --filter @nebula/screen-sdk lint
```

当前 tarball consumer 覆盖 Vanilla registry、React ref 赋值和 Vue ref 赋值的构建 smoke。
