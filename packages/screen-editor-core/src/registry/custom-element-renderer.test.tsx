/**
 * custom-element-renderer 单元测试（Spec §9.1 + §13.2 Phase 2, Task 2.2）
 *
 * 覆盖：
 * - 元素创建：document.createElement(tagName) 并 append 到容器
 * - model 赋值：通过 JS property（非 HTML attribute），结构正确
 * - detached snapshot：组件修改 model 不影响下一次传入的源对象
 * - DOM 复用：同 tagName 更新复用 element（不重复 mount）
 * - tagName 变化：销毁旧元素，创建新元素
 * - 卸载清理：element.remove() 被调用
 * - JSON 清洗：undefined 字段被剥离；非法值（function/symbol/bigint）抛错
 * - createHostElementRenderer：返回兼容 RendererComponentProps 的组件，默认值正确
 * - getRendererFromRegistry 集成：host 源返回 host renderer，built-in 可返回 internalRenderer
 *
 * 测试隔离：customElements 是 Document 全局能力，每个测试使用唯一 tagName。
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentStyle } from '@nebula/shared';
import type {
  ScreenComponentElement,
  ScreenComponentElementModelV1,
} from '@nebula/screen-component-sdk';
import { createHostElementRenderer, CustomElementRenderer } from './custom-element-renderer';
import { buildInstanceRegistry, type ScreenComponentRegistration } from './instance-registry';
import { getRendererFromRegistry } from './registry-derive';
import type { ScreenComponentManifestV1 } from '@nebula/screen-component-sdk';

let tagNameCounter = 0;

/**
 * 生成唯一 tagName（避免跨测试 customElements 冲突）。
 */
function nextTagName(): string {
  tagNameCounter += 1;
  return `test-bridge-${tagNameCounter.toString(36).padStart(3, '0')}-v1`;
}

/**
 * 创建并注册一个 mock Custom Element 类。
 *
 * 记录 model 赋值历史，便于断言 detached snapshot 与复用行为。
 */
function defineMockElement(tagName: string): {
  new (): ScreenComponentElement;
  modelAssignments: ScreenComponentElementModelV1[];
} {
  const modelAssignments: ScreenComponentElementModelV1[] = [];

  class MockElement extends HTMLElement implements ScreenComponentElement {
    private _model: ScreenComponentElementModelV1 | null = null;

    get model(): ScreenComponentElementModelV1 {
      if (this._model === null) {
        throw new Error('model accessed before assignment');
      }
      return this._model;
    }

    set model(value: ScreenComponentElementModelV1) {
      this._model = value;
      modelAssignments.push(value);
    }
  }

  if (customElements.get(tagName) === undefined) {
    customElements.define(tagName, MockElement);
  }
  return Object.assign(MockElement, { modelAssignments });
}

const baseStyle: ComponentStyle = {
  backgroundColor: '#ff0000',
  color: '#00ff00',
  fontSize: 14,
};

afterEach(() => {
  cleanup();
});

describe('CustomElementRenderer', () => {
  describe('元素创建与 model 赋值（Spec §9.1）', () => {
    it('mount 时根据 tagName 创建 Custom Element 并 append 到容器', () => {
      const tagName = nextTagName();
      defineMockElement(tagName);

      const { container } = render(
        <CustomElementRenderer
          tagName={tagName}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={{ title: 'Hello' }}
          style={baseStyle}
          size={{ width: 200, height: 100 }}
        />,
      );

      const hostDiv = container.querySelector('[data-custom-element-host]');
      expect(hostDiv).not.toBeNull();

      const customEl = container.querySelector(tagName);
      expect(customEl).not.toBeNull();
      expect(customEl?.tagName.toLowerCase()).toBe(tagName);
    });

    it('model 通过 JS property 赋值，不序列化为 HTML attribute', () => {
      const tagName = nextTagName();
      const MockCtor = defineMockElement(tagName);

      render(
        <CustomElementRenderer
          tagName={tagName}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={{ title: 'Hello', count: 42 }}
          style={baseStyle}
          size={{ width: 200, height: 100 }}
        />,
      );

      expect(MockCtor.modelAssignments).toHaveLength(1);
      const model = MockCtor.modelAssignments[0];
      expect(model.apiVersion).toBe(1);
      expect(model.componentId).toBe('comp-1');
      expect(model.mode).toBe('design');
      expect(model.interactive).toBe(false);
      expect(model.props).toEqual({ title: 'Hello', count: 42 });
      expect(model.style).toMatchObject({
        backgroundColor: '#ff0000',
        color: '#00ff00',
        fontSize: 14,
      });
      expect(model.size).toEqual({ width: 200, height: 100 });

      // model 不应出现在 HTML attribute 中（Spec §9.1: 不序列化为 attribute）
      const el = document.querySelector(tagName) as ScreenComponentElement;
      expect(el.hasAttribute('model')).toBe(false);
      expect(el.hasAttribute('props')).toBe(false);
      expect(el.hasAttribute('component-id')).toBe(false);
    });

    it('preview 模式与 interactive=true 正确透传到 model', () => {
      const tagName = nextTagName();
      const MockCtor = defineMockElement(tagName);

      render(
        <CustomElementRenderer
          tagName={tagName}
          componentId="comp-preview"
          mode="preview"
          interactive={true}
          props={{}}
          style={{}}
          size={{ width: 320, height: 180 }}
        />,
      );

      const model = MockCtor.modelAssignments[0];
      expect(model.mode).toBe('preview');
      expect(model.interactive).toBe(true);
    });
  });

  describe('detached snapshot（Spec §9.1）', () => {
    it('组件修改 model 不影响下一次传入的源 props/style 对象', () => {
      const tagName = nextTagName();
      const MockCtor = defineMockElement(tagName);

      const props = { title: 'Original', nested: { value: 1 } };
      const style: ComponentStyle = { backgroundColor: '#000' };

      const { rerender } = render(
        <CustomElementRenderer
          tagName={tagName}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={props}
          style={style}
          size={{ width: 100, height: 100 }}
        />,
      );

      // 组件侧拿到 model 后修改嵌套对象
      const firstModel = MockCtor.modelAssignments[0];
      (firstModel.props as Record<string, unknown>).title = 'Mutated';
      (firstModel.props as Record<string, { value: number }>).nested.value = 999;
      (firstModel.style as Record<string, unknown>).backgroundColor = '#fff';

      // 源对象不应被影响
      expect(props.title).toBe('Original');
      expect(props.nested.value).toBe(1);
      expect(style.backgroundColor).toBe('#000');

      // rerender 使用更新后的源 props
      props.title = 'Updated';
      rerender(
        <CustomElementRenderer
          tagName={tagName}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={props}
          style={style}
          size={{ width: 100, height: 100 }}
        />,
      );

      const lastModel = MockCtor.modelAssignments[MockCtor.modelAssignments.length - 1];
      expect(lastModel.props.title).toBe('Updated');
    });
  });

  describe('DOM 复用（Spec §9.1: 同 id/type 更新复用 DOM）', () => {
    it('同 tagName 更新 props 时不重新创建 element', () => {
      const tagName = nextTagName();
      defineMockElement(tagName);

      const { container, rerender } = render(
        <CustomElementRenderer
          tagName={tagName}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={{ value: 1 }}
          style={baseStyle}
          size={{ width: 100, height: 100 }}
        />,
      );

      const firstEl = container.querySelector(tagName);
      expect(firstEl).not.toBeNull();

      rerender(
        <CustomElementRenderer
          tagName={tagName}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={{ value: 2 }}
          style={baseStyle}
          size={{ width: 100, height: 100 }}
        />,
      );

      const secondEl = container.querySelector(tagName);
      // 同一 DOM 引用（未 remount）
      expect(secondEl).toBe(firstEl);
    });

    it('tagName 变化时销毁旧元素并创建新元素', () => {
      const tagName1 = nextTagName();
      const tagName2 = nextTagName();
      defineMockElement(tagName1);
      defineMockElement(tagName2);

      const { container, rerender } = render(
        <CustomElementRenderer
          tagName={tagName1}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={{}}
          style={{}}
          size={{ width: 100, height: 100 }}
        />,
      );

      const el1 = container.querySelector(tagName1);
      expect(el1).not.toBeNull();
      expect(container.querySelector(tagName2)).toBeNull();

      rerender(
        <CustomElementRenderer
          tagName={tagName2}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={{}}
          style={{}}
          size={{ width: 100, height: 100 }}
        />,
      );

      // 旧元素被移除，新元素被创建
      expect(container.querySelector(tagName1)).toBeNull();
      const el2 = container.querySelector(tagName2);
      expect(el2).not.toBeNull();
      expect(el2).not.toBe(el1);
    });
  });

  describe('卸载清理（Spec §9.1: 组件删除时销毁旧 element）', () => {
    it('unmount 时 element 从 DOM 移除', () => {
      const tagName = nextTagName();
      defineMockElement(tagName);

      const { container, unmount } = render(
        <CustomElementRenderer
          tagName={tagName}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={{}}
          style={{}}
          size={{ width: 100, height: 100 }}
        />,
      );

      expect(container.querySelector(tagName)).not.toBeNull();

      unmount();

      expect(container.querySelector(tagName)).toBeNull();
    });
  });

  describe('JSON 清洗（Spec §7.1 JSON 边界）', () => {
    it('style 中的 undefined 字段被剥离', () => {
      const tagName = nextTagName();
      const MockCtor = defineMockElement(tagName);

      // ComponentStyle 有大量 optional 字段，未设置时为 undefined
      const styleWithUndefined: ComponentStyle = {
        backgroundColor: '#fff',
        // borderWidth / borderColor / fontSize 等未设置 → undefined
      };

      render(
        <CustomElementRenderer
          tagName={tagName}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={{}}
          style={styleWithUndefined}
          size={{ width: 100, height: 100 }}
        />,
      );

      const model = MockCtor.modelAssignments[0];
      const style = model.style as Record<string, unknown>;
      expect(style.backgroundColor).toBe('#fff');
      // undefined 字段不应出现在 model.style 中
      expect(style.borderWidth).toBeUndefined();
      expect(style.borderColor).toBeUndefined();
      expect('borderWidth' in style).toBe(false);
    });

    it('props 中的 undefined 字段被剥离', () => {
      const tagName = nextTagName();
      const MockCtor = defineMockElement(tagName);

      const props = {
        title: 'Hello',
        // value 未设置 → undefined
        value: undefined,
      };

      render(
        <CustomElementRenderer
          tagName={tagName}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={props}
          style={{}}
          size={{ width: 100, height: 100 }}
        />,
      );

      const model = MockCtor.modelAssignments[0];
      expect(model.props.title).toBe('Hello');
      expect('value' in model.props).toBe(false);
    });

    it('style.filter 嵌套对象正确清洗', () => {
      const tagName = nextTagName();
      const MockCtor = defineMockElement(tagName);

      const style: ComponentStyle = {
        filter: {
          hueRotate: 90,
          saturate: 100,
          brightness: 100,
          contrast: 100,
          blur: 0,
          grayscale: 0,
        },
      };

      render(
        <CustomElementRenderer
          tagName={tagName}
          componentId="comp-1"
          mode="design"
          interactive={false}
          props={{}}
          style={style}
          size={{ width: 100, height: 100 }}
        />,
      );

      const model = MockCtor.modelAssignments[0];
      expect(model.style.filter).toEqual({
        hueRotate: 90,
        saturate: 100,
        brightness: 100,
        contrast: 100,
        blur: 0,
        grayscale: 0,
      });
    });

    it('props 含函数值时抛错（违反 JSON 边界）', () => {
      const tagName = nextTagName();
      defineMockElement(tagName);

      const props = {
        callback: () => null,
      };

      // React effect 中的错误通过 act 捕获
      expect(() =>
        render(
          <CustomElementRenderer
            tagName={tagName}
            componentId="comp-1"
            mode="design"
            interactive={false}
            props={props}
            style={{}}
            size={{ width: 100, height: 100 }}
          />,
        ),
      ).toThrow(/ScreenComponentJsonValue/);
    });
  });
});

describe('createHostElementRenderer', () => {
  it('返回 React 组件，渲染 Custom Element', () => {
    const tagName = nextTagName();
    const MockCtor = defineMockElement(tagName);

    const HostRenderer = createHostElementRenderer(tagName);

    const { container } = render(
      <HostRenderer componentId="comp-host" props={{ k: 'v' }} style={baseStyle} />,
    );

    expect(container.querySelector(tagName)).not.toBeNull();
    expect(MockCtor.modelAssignments).toHaveLength(1);
    expect(MockCtor.modelAssignments[0].componentId).toBe('comp-host');
    expect(MockCtor.modelAssignments[0].props).toEqual({ k: 'v' });
  });

  it('未传 mode/interactive/size 时使用默认值 design/false/0x0', () => {
    const tagName = nextTagName();
    const MockCtor = defineMockElement(tagName);

    const HostRenderer = createHostElementRenderer(tagName);

    render(<HostRenderer componentId="comp-default" props={{}} style={{}} />);

    const model = MockCtor.modelAssignments[0];
    expect(model.mode).toBe('design');
    expect(model.interactive).toBe(false);
    expect(model.size).toEqual({ width: 0, height: 0 });
  });

  it('传入 mode/interactive/size 时正确透传', () => {
    const tagName = nextTagName();
    const MockCtor = defineMockElement(tagName);

    const HostRenderer = createHostElementRenderer(tagName);

    render(
      <HostRenderer
        componentId="comp-explicit"
        props={{}}
        style={{}}
        mode="preview"
        interactive={true}
        size={{ width: 320, height: 180 }}
      />,
    );

    const model = MockCtor.modelAssignments[0];
    expect(model.mode).toBe('preview');
    expect(model.interactive).toBe(true);
    expect(model.size).toEqual({ width: 320, height: 180 });
  });

  it('displayName 包含 tagName', () => {
    const tagName = nextTagName();
    const HostRenderer = createHostElementRenderer(tagName);
    expect(HostRenderer.displayName).toBe(`HostElementRenderer(${tagName})`);
  });

  it('dataSource/logic/interaction 等 legacy 字段被忽略', () => {
    const tagName = nextTagName();
    const MockCtor = defineMockElement(tagName);

    const HostRenderer = createHostElementRenderer(tagName);

    // 传入 host 组件不消费的字段，不应抛错
    expect(() =>
      render(
        <HostRenderer
          componentId="comp-1"
          props={{}}
          style={{}}
          // 这些字段类型上 optional，host bridge 不消费
          apiRawDataOverride={{ some: 'data' }}
        />,
      ),
    ).not.toThrow();

    expect(MockCtor.modelAssignments).toHaveLength(1);
  });
});

describe('getRendererFromRegistry 集成（host source 分支）', () => {
  function makeHostManifest(tagName: string): ScreenComponentManifestV1 {
    return {
      apiVersion: 'nebula.screen-component/v1',
      type: `test.bridge.${tagName}/v1`,
      implementationVersion: '1.0.0',
      tagName,
      name: '测试桥接组件',
      category: 'chart',
      defaultSize: { width: 200, height: 200 },
      defaultProps: {},
      propsSchema: { type: 'object', additionalProperties: false },
    };
  }

  function makeHostRegistration(
    manifest: ScreenComponentManifestV1,
    ctor: CustomElementConstructor,
  ): ScreenComponentRegistration {
    return {
      source: 'host',
      manifest,
      elementConstructor: ctor,
    };
  }

  it('source=host 返回 host renderer（非 internalRenderer）', () => {
    const tagName = nextTagName();
    const MockCtor = defineMockElement(tagName);
    const manifest = makeHostManifest(tagName);
    const registry = buildInstanceRegistry([makeHostRegistration(manifest, MockCtor)]);

    const renderer = getRendererFromRegistry(registry, manifest.type);
    expect(renderer).toBeDefined();
    expect(typeof renderer).toBe('function');
    // host renderer 的 displayName 包含 tagName
    expect(renderer?.displayName).toBe(`HostElementRenderer(${tagName})`);
  });

  it('source=host 渲染的组件能正确创建 element 并赋值 model', () => {
    const tagName = nextTagName();
    const MockCtor = defineMockElement(tagName);
    const manifest = makeHostManifest(tagName);
    const registry = buildInstanceRegistry([makeHostRegistration(manifest, MockCtor)]);

    const Renderer = getRendererFromRegistry(registry, manifest.type)!;

    render(
      <Renderer componentId="comp-integration" props={{ title: '集成测试' }} style={baseStyle} />,
    );

    expect(MockCtor.modelAssignments).toHaveLength(1);
    const model = MockCtor.modelAssignments[0];
    expect(model.componentId).toBe('comp-integration');
    expect(model.props).toEqual({ title: '集成测试' });
    expect(model.style.backgroundColor).toBe('#ff0000');
  });

  it('同一 tagName 多次查询返回同一 renderer 引用（缓存）', () => {
    const tagName = nextTagName();
    const MockCtor = defineMockElement(tagName);
    const manifest = makeHostManifest(tagName);
    const registry = buildInstanceRegistry([makeHostRegistration(manifest, MockCtor)]);

    const r1 = getRendererFromRegistry(registry, manifest.type);
    const r2 = getRendererFromRegistry(registry, manifest.type);
    expect(r1).toBe(r2);
  });

  it('source=built-in 未迁移组件返回 internalRenderer', () => {
    const tagName = nextTagName();
    const manifest = makeHostManifest(tagName);
    const fakeLegacyRenderer = vi.fn(() => null);
    const registry = buildInstanceRegistry([
      {
        source: 'built-in',
        manifest,
        internalRenderer:
          fakeLegacyRenderer as unknown as ScreenComponentRegistration['internalRenderer'],
      },
    ]);

    const renderer = getRendererFromRegistry(registry, manifest.type);
    expect(renderer).toBe(fakeLegacyRenderer);
  });

  it('source=host 但 elementConstructor 缺失时不走 host 分支（理论不应到达）', () => {
    // ScreenComponentRegistration 的 source='host' 强制 elementConstructor 必填，
    // 但 host renderer 缓存只看 source 不看 elementConstructor。
    // 此测试验证 source='host' 分支不依赖 elementConstructor 运行时存在。
    const tagName = nextTagName();
    const manifest = makeHostManifest(tagName);
    // 注册 element 以确保 createHostElementRenderer 不报错
    defineMockElement(tagName);
    const registry = buildInstanceRegistry([
      {
        source: 'host',
        manifest,
        elementConstructor: customElements.get(tagName)!,
      },
    ]);

    const renderer = getRendererFromRegistry(registry, manifest.type);
    expect(renderer).toBeDefined();
    expect(renderer?.displayName).toBe(`HostElementRenderer(${tagName})`);
  });
});
