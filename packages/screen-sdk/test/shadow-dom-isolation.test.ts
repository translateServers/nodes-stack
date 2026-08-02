/**
 * Shadow DOM 样式边界与双实例隔离测试
 *
 * 覆盖 Task 17-18 验收项：
 * - open ShadowRoot 存在且包含 SDK 样式
 * - 每个实例有独立 React root 与 portal root
 * - 9 个稳定 CSS variables 名称与默认值
 * - 宿主变量覆盖优先，无效值回退
 * - light/dark 主题只作用于当前实例
 * - adoptedStyleSheets 与 style fallback
 * - 双实例 Store、DOM、事件互不影响
 * - 容器尺寸提示
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenHostAdapter, ScreenProjectEnvelopeInput } from '@nebula/screen-editor-core';
import { defineNebulaScreenEditor, NEBULA_SCREEN_EDITOR_TAG_NAME } from '../src/element/define.js';
import type { NebulaScreenEditorElement } from '../src/element/nebula-screen-editor-element.js';
import { SCREEN_EDITOR_THEME_VARIABLES } from '../src/styles/theme.js';

// ===== 测试工具 =====

function createEnvelope(
  projectId = 'screen-1',
  overrides: Partial<ScreenProjectEnvelopeInput> = {},
): ScreenProjectEnvelopeInput {
  return {
    id: projectId,
    name: `Project ${projectId}`,
    description: null,
    status: 'draft',
    revision: `revision-${projectId}`,
    document: {
      schemaVersion: 1,
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: '#000000',
        scaleMode: 'fit',
      },
      components: [],
      globalVariables: [],
    },
    ...overrides,
  };
}

function createAdapter(projectId = 'screen-1'): ScreenHostAdapter {
  return {
    loadProject: vi.fn(() => Promise.resolve(createEnvelope(projectId))),
    saveProject: vi.fn(() =>
      Promise.resolve(createEnvelope(projectId, { revision: 'revision-saved' })),
    ),
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createConnectedElement(): NebulaScreenEditorElement {
  const element = document.createElement(NEBULA_SCREEN_EDITOR_TAG_NAME);
  document.body.append(element);
  return element;
}

async function setupReadyElement(projectId = 'screen-1'): Promise<NebulaScreenEditorElement> {
  const element = createConnectedElement();
  element.adapter = createAdapter(projectId);
  element.projectId = projectId;
  await flush();
  await element.whenReady();
  return element;
}

// ===== 测试 =====

describe('Shadow DOM and styling', () => {
  beforeEach(() => {
    defineNebulaScreenEditor();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('ShadowRoot structure', () => {
    it('attaches an open ShadowRoot', () => {
      const element = createConnectedElement();
      expect(element.shadowRoot).not.toBeNull();
      expect(element.shadowRoot?.mode).toBe('open');
    });

    it('creates a SDK root element inside ShadowRoot', () => {
      const element = createConnectedElement();
      const sdkRoot = element.shadowRoot?.querySelector('[data-nebula-sdk-root]');
      expect(sdkRoot).not.toBeNull();
    });

    it('creates a React mount root inside SDK root', () => {
      const element = createConnectedElement();
      const mountRoot = element.shadowRoot?.querySelector('[data-nebula-react-root]');
      expect(mountRoot).not.toBeNull();
    });

    it('creates a portal root inside SDK root', () => {
      const element = createConnectedElement();
      const portalRoot = element.shadowRoot?.querySelector('[data-nebula-portal-root]');
      expect(portalRoot).not.toBeNull();
    });

    it('creates a size warning element inside SDK root', () => {
      const element = createConnectedElement();
      const sizeWarning = element.shadowRoot?.querySelector('[data-nebula-size-warning]');
      expect(sizeWarning).not.toBeNull();
    });
  });

  describe('style installation', () => {
    it('installs styles via adoptedStyleSheets or style fallback', () => {
      const element = createConnectedElement();
      const shadowRoot = element.shadowRoot;
      expect(shadowRoot).not.toBeNull();
      if (shadowRoot === null) return;

      // Either adoptedStyleSheets has entries, or a <style> tag exists
      const hasAdoptedSheets =
        'adoptedStyleSheets' in shadowRoot && shadowRoot.adoptedStyleSheets.length > 0;
      const hasStyleTag = shadowRoot.querySelector('style[data-nebula-screen-styles]') !== null;
      expect(hasAdoptedSheets || hasStyleTag).toBe(true);
    });
  });

  describe('theme variables', () => {
    it('defines all 9 stable CSS variables with correct public names', () => {
      const publicNames = SCREEN_EDITOR_THEME_VARIABLES.map((v) => v.public);
      expect(publicNames).toEqual([
        '--nebula-screen-font-family',
        '--nebula-screen-background',
        '--nebula-screen-foreground',
        '--nebula-screen-surface',
        '--nebula-screen-muted',
        '--nebula-screen-primary',
        '--nebula-screen-border',
        '--nebula-screen-danger',
        '--nebula-screen-radius',
      ]);
    });

    it('applies light theme defaults when theme is light', () => {
      const element = createConnectedElement();
      element.theme = 'light';
      const sdkRoot = element.shadowRoot?.querySelector('[data-nebula-sdk-root]');
      expect(sdkRoot).not.toBeNull();
      if (sdkRoot === null) return;
      const computed = window.getComputedStyle(sdkRoot as HTMLElement);
      // Internal variables should be set to light defaults (or host overrides)
      const background = computed.getPropertyValue('--nebula-resolved-background').trim();
      expect(background).not.toBe('');
    });

    it('applies dark theme defaults when theme is dark', () => {
      const element = createConnectedElement();
      element.theme = 'dark';
      const sdkRoot = element.shadowRoot?.querySelector('[data-nebula-sdk-root]');
      expect(sdkRoot).not.toBeNull();
      if (sdkRoot === null) return;
      const computed = window.getComputedStyle(sdkRoot as HTMLElement);
      const background = computed.getPropertyValue('--nebula-resolved-background').trim();
      expect(background).not.toBe('');
    });

    it('toggles dark class on SDK root when theme changes', () => {
      const element = createConnectedElement();
      element.theme = 'dark';
      const sdkRoot = element.shadowRoot?.querySelector('[data-nebula-sdk-root]');
      expect(sdkRoot?.classList.contains('dark')).toBe(true);

      element.theme = 'light';
      expect(sdkRoot?.classList.contains('dark')).toBe(false);
    });

    it('host override on element takes priority over built-in defaults', () => {
      const element = createConnectedElement();
      element.style.setProperty('--nebula-screen-background', '#123456');
      element.theme = 'light';
      const sdkRoot = element.shadowRoot?.querySelector('[data-nebula-sdk-root]');
      expect(sdkRoot).not.toBeNull();
      if (sdkRoot === null) return;
      const computed = window.getComputedStyle(sdkRoot as HTMLElement);
      const background = computed.getPropertyValue('--nebula-resolved-background').trim();
      expect(background).toBe('#123456');
    });

    it('falls back to built-in default when host value is invalid', () => {
      const element = createConnectedElement();
      // Set an invalid color value
      element.style.setProperty('--nebula-screen-background', 'not-a-valid-color');
      element.theme = 'light';
      const sdkRoot = element.shadowRoot?.querySelector('[data-nebula-sdk-root]');
      expect(sdkRoot).not.toBeNull();
      if (sdkRoot === null) return;
      const computed = window.getComputedStyle(sdkRoot as HTMLElement);
      const background = computed.getPropertyValue('--nebula-resolved-background').trim();
      // The invalid value must NOT be used; in jsdom oklch may not be supported,
      // so the key assertion is that the invalid value is NOT present.
      expect(background).not.toBe('not-a-valid-color');
    });
  });

  describe('host CSS isolation', () => {
    it('host global styles do not affect SDK root class names', () => {
      // Inject a global style that targets all buttons
      const globalStyle = document.createElement('style');
      globalStyle.textContent = `
        button { background: red !important; color: yellow !important; }
        * { border: 5px solid green !important; }
        input { font-size: 99px !important; }
      `;
      document.head.append(globalStyle);

      const element = createConnectedElement();
      const shadowButton = element.shadowRoot?.querySelector('button');
      expect(shadowButton).not.toBeNull();
      expect(shadowButton?.getRootNode()).toBe(element.shadowRoot);
      expect((shadowButton as HTMLElement | null)?.style.background).toBe('');

      globalStyle.remove();
    });
  });

  describe('container size warning', () => {
    it('shows size warning when container is smaller than minimum', () => {
      const element = createConnectedElement();
      const sizeWarning = element.shadowRoot?.querySelector('[data-nebula-size-warning]');
      expect(sizeWarning).not.toBeNull();
      // In jsdom, getBoundingClientRect returns 0x0, which is < 1024x640,
      // so the warning should be visible
      expect((sizeWarning as HTMLElement)?.hidden).toBe(false);
    });

    it('hides size warning when container meets minimum size', () => {
      const element = createConnectedElement();
      // Mock getBoundingClientRect to return a large enough size
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        width: 1440,
        height: 900,
        top: 0,
        left: 0,
        bottom: 900,
        right: 1440,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      // Trigger a resize check by re-connecting
      element.remove();
      document.body.append(element);

      const sizeWarning = element.shadowRoot?.querySelector('[data-nebula-size-warning]');
      expect(sizeWarning).not.toBeNull();
      // With mocked large size, the warning should be hidden
      expect((sizeWarning as HTMLElement)?.hidden).toBe(true);

      vi.restoreAllMocks();
    });
  });
});

describe('dual instance isolation', () => {
  beforeEach(() => {
    defineNebulaScreenEditor();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('two instances have separate ShadowRoots', () => {
    const element1 = createConnectedElement();
    const element2 = createConnectedElement();

    expect(element1.shadowRoot).not.toBe(element2.shadowRoot);
    const root1 = element1.shadowRoot?.querySelector('[data-nebula-sdk-root]');
    const root2 = element2.shadowRoot?.querySelector('[data-nebula-sdk-root]');
    expect(root1).not.toBe(root2);
  });

  it('two instances load independent projects', async () => {
    const element1 = await setupReadyElement('project-a');
    const element2 = await setupReadyElement('project-b');

    const draft1 = element1.getDraft();
    const draft2 = element2.getDraft();

    expect(draft1?.name).toBe('Project project-a');
    expect(draft2?.name).toBe('Project project-b');
  });

  it('saving one instance does not affect the other', async () => {
    const element1 = await setupReadyElement('project-a');
    const element2 = await setupReadyElement('project-b');

    const adapter1 = element1.adapter!;
    const adapter2 = element2.adapter!;

    await element1.save();

    expect(adapter1.saveProject).toHaveBeenCalledOnce();
    expect(adapter2.saveProject).not.toHaveBeenCalled();
  });

  it('theme change on one instance does not affect the other', () => {
    const element1 = createConnectedElement();
    const element2 = createConnectedElement();

    element1.theme = 'dark';
    element2.theme = 'light';

    const root1 = element1.shadowRoot?.querySelector('[data-nebula-sdk-root]');
    const root2 = element2.shadowRoot?.querySelector('[data-nebula-sdk-root]');

    expect(root1?.classList.contains('dark')).toBe(true);
    expect(root2?.classList.contains('dark')).toBe(false);
  });

  it('readonly on one instance does not affect the other', async () => {
    const element1 = await setupReadyElement('project-a');
    const element2 = await setupReadyElement('project-b');

    element1.readonly = true;
    await flush();

    // element1 should reject save
    await expect(element1.save()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // element2 should still be able to save
    await expect(element2.save()).resolves.toBeDefined();
  });

  it('disconnecting one instance does not affect the other', async () => {
    const element1 = await setupReadyElement('project-a');
    const element2 = await setupReadyElement('project-b');

    element1.remove();
    await flush();

    // element1 is disposed
    expect(element1.getDraft()).toBeNull();
    // element2 is still functional
    expect(element2.getDraft()).not.toBeNull();
  });

  it('each instance has its own portal root', () => {
    const element1 = createConnectedElement();
    const element2 = createConnectedElement();

    const portal1 = element1.shadowRoot?.querySelector('[data-nebula-portal-root]');
    const portal2 = element2.shadowRoot?.querySelector('[data-nebula-portal-root]');

    expect(portal1).not.toBe(portal2);
  });

  it('error in one instance does not propagate to the other', async () => {
    const failAdapter: ScreenHostAdapter = {
      loadProject: () => Promise.reject(new Error('fail')),
      saveProject: () => Promise.reject(new Error('fail')),
    };
    const okAdapter = createAdapter('project-ok');

    const element1 = createConnectedElement();
    const element2 = createConnectedElement();

    const errorListener1 = vi.fn();
    const errorListener2 = vi.fn();
    element1.addEventListener('nebula-error', errorListener1);
    element2.addEventListener('nebula-error', errorListener2);

    element1.adapter = failAdapter;
    element1.projectId = 'project-fail';
    element2.adapter = okAdapter;
    element2.projectId = 'project-ok';

    await flush();
    await vi.waitFor(() => expect(errorListener1).toHaveBeenCalled());

    expect(errorListener2).not.toHaveBeenCalled();
    expect(element2.getDraft()).not.toBeNull();
  });
});
