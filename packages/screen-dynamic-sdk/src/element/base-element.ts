/**
 * screen-dynamic-sdk 元素基类。
 *
 * 负责 shadow DOM、尺寸观察、主题、运行时挂载与公共属性同步。
 * 非懒加载：直接导入运行时装配（体积分流由构建分包完成）。
 */

import type {
  DynamicScreenDocumentV3,
  ScreenSdkDiagnostic,
} from '@nebula/screen-editor-core/dynamic';
import type { ScreenComponentInstanceRegistry } from '@nebula/screen-editor-core/experimental';
import { dispatchScreenDynamicEvent } from './events.js';
import type {
  ScreenDynamicElementConfig,
  ScreenDynamicMountOptions,
  ScreenDynamicRuntime,
  ScreenDynamicSdkOptions,
} from './contracts.js';

let instanceCounter = 0;

function cloneDocument(document: DynamicScreenDocumentV3): DynamicScreenDocumentV3 {
  return structuredClone(document);
}

function cloneOptions(options: ScreenDynamicSdkOptions | undefined): ScreenDynamicSdkOptions {
  if (options === undefined) return {};
  return structuredClone(options);
}

export abstract class ScreenDynamicElementBase extends HTMLElement {
  static readonly observedAttributes = ['theme'];

  readonly #instanceId: string;
  readonly #mountRoot: HTMLDivElement;
  readonly #portalRoot: HTMLDivElement;
  readonly #runtimeError: HTMLDivElement;
  readonly #runtimeErrorMessage: HTMLSpanElement;
  readonly #runtimeRetryButton: HTMLButtonElement;
  #document?: DynamicScreenDocumentV3;
  #dataAdapter?: ScreenDynamicElementConfig['dataAdapter'];
  #componentRegistry?: ScreenComponentInstanceRegistry;
  #registryFrozen = false;
  #options?: ScreenDynamicSdkOptions;
  #theme: 'light' | 'dark' = 'light';
  #resizeObserver?: ResizeObserver;
  #runtime?: ScreenDynamicRuntime;

  protected abstract mount(options: ScreenDynamicMountOptions): ScreenDynamicRuntime;

  readonly #retryRuntime = (): void => {
    this.#clearRuntimeError();
    try {
      this.#runtime = this.mount(this.#configuration());
      this.#runtime.whenReady().catch(() => undefined);
    } catch (error: unknown) {
      this.#handleMountError(error);
    }
  };

  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    const style = this.ownerDocument.createElement('style');
    // position: relative 让宿主成为 shadow 内绝对定位子元素的包含块
    // （否则 abspos 子元素以视口为包含块，会溢出覆盖宿主外区域）
    style.textContent =
      ':host { display: block; position: relative; width: 100%; height: 100%; overflow: hidden; }';
    shadowRoot.append(style);

    this.#instanceId = `${this.constructor.name.toLowerCase()}-${++instanceCounter}`;
    this.#mountRoot = this.ownerDocument.createElement('div');
    this.#mountRoot.style.cssText = 'position:absolute; inset:0;';
    this.#portalRoot = this.ownerDocument.createElement('div');
    this.#portalRoot.style.cssText = 'position:absolute; inset:0; pointer-events:none;';
    this.#runtimeError = this.ownerDocument.createElement('div');
    this.#runtimeError.dataset['nebulaRuntimeError'] = '';
    this.#runtimeError.setAttribute('role', 'alert');
    this.#runtimeError.style.cssText =
      'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#000000cc; color:#fff; font:14px/1.5 sans-serif;';
    this.#runtimeError.hidden = true;
    this.#runtimeErrorMessage = this.ownerDocument.createElement('span');
    this.#runtimeErrorMessage.dataset['nebulaRuntimeErrorMessage'] = '';
    this.#runtimeRetryButton = this.ownerDocument.createElement('button');
    this.#runtimeRetryButton.type = 'button';
    this.#runtimeRetryButton.textContent = '重试';
    this.#runtimeRetryButton.addEventListener('click', this.#retryRuntime);
    this.#runtimeError.append(this.#runtimeErrorMessage, this.#runtimeRetryButton);
    shadowRoot.append(this.#mountRoot, this.#portalRoot, this.#runtimeError);
  }

  get document(): DynamicScreenDocumentV3 | undefined {
    return this.#document === undefined ? undefined : cloneDocument(this.#document);
  }

  set document(document: DynamicScreenDocumentV3 | undefined) {
    if (document === undefined) {
      this.#document = undefined;
      this.#updateRuntime();
      return;
    }
    const next = cloneDocument(document);
    if (JSON.stringify(next) === JSON.stringify(this.#document)) return;
    this.#document = next;
    this.#updateRuntime();
  }

  get dataAdapter(): ScreenDynamicElementConfig['dataAdapter'] {
    return this.#dataAdapter;
  }

  set dataAdapter(adapter: ScreenDynamicElementConfig['dataAdapter']) {
    if (this.#dataAdapter === adapter) return;
    this.#dataAdapter = adapter;
    this.#updateRuntime();
  }

  get componentRegistry(): ScreenComponentInstanceRegistry | undefined {
    return this.#componentRegistry;
  }

  set componentRegistry(registry: ScreenComponentInstanceRegistry | undefined) {
    if (this.#registryFrozen) {
      throw new DOMException(
        'componentRegistry is frozen after mount has started; create a new element to use a different registry.',
        'InvalidStateError',
      );
    }
    if (this.#componentRegistry === registry) return;
    this.#componentRegistry = registry;
  }

  get options(): ScreenDynamicSdkOptions | undefined {
    return this.#options === undefined ? undefined : cloneOptions(this.#options);
  }

  set options(options: ScreenDynamicSdkOptions | undefined) {
    if (this.#options === options) return;
    this.#options = options === undefined ? undefined : cloneOptions(options);
    if (this.isConnected) this.#restartRuntime();
  }

  get readonly(): boolean {
    return this.hasAttribute('readonly');
  }

  set readonly(readonly: boolean) {
    this.toggleAttribute('readonly', readonly);
  }

  get theme(): 'light' | 'dark' {
    return this.#theme;
  }

  set theme(theme: 'light' | 'dark') {
    this.#theme = theme;
    this.#applyTheme();
  }

  connectedCallback(): void {
    this.#observeSize();
    this.#updateRuntime();
  }

  disconnectedCallback(): void {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#runtime?.dispose();
    this.#runtime = undefined;
  }

  attributeChangedCallback(name: string, previous: string | null, next: string | null): void {
    if (previous === next) return;
    if (name === 'theme') this.#applyTheme();
  }

  whenReady(): Promise<void> {
    return Promise.resolve(this.#runtime?.whenReady() ?? Promise.resolve());
  }

  getDocument(): DynamicScreenDocumentV3 | null {
    return this.#runtime?.getDocument() ?? null;
  }

  reload(): void {
    this.#runtime?.reload();
  }

  save(): DynamicScreenDocumentV3 {
    if (this.#runtime === undefined || this.readonly) {
      throw new DOMException('runtime unavailable or readonly', 'InvalidStateError');
    }
    return structuredClone(this.#runtime.save());
  }

  publish(): DynamicScreenDocumentV3 {
    if (this.#runtime === undefined || this.readonly) {
      throw new DOMException('runtime unavailable or readonly', 'InvalidStateError');
    }
    return structuredClone(this.#runtime.publish());
  }

  undo(): void {
    if (!this.readonly) this.#runtime?.undo();
  }

  redo(): void {
    if (!this.readonly) this.#runtime?.redo();
  }

  validate(): ScreenSdkDiagnostic[] {
    return structuredClone(this.#runtime?.validate() ?? []);
  }

  #configuration(): ScreenDynamicMountOptions {
    return {
      document: this.#document ?? {
        schemaVersion: 3,
        canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
        components: [],
        globalVariables: [],
      },
      dataAdapter: this.#dataAdapter,
      componentRegistry: this.#componentRegistry,
      eventTarget: this,
      identifierPrefix: `${this.#instanceId}-`,
      mountRoot: this.#mountRoot,
      options: {
        debug: this.#options?.debug ?? false,
        persistPreferences: this.#options?.persistPreferences ?? true,
        preferenceNamespace: this.#options?.preferenceNamespace ?? 'nebula:screen-dynamic-sdk',
        refreshIntervalSeconds: this.#options?.refreshIntervalSeconds ?? 0,
      },
      readonly: this.readonly,
      theme: this.theme,
    };
  }

  #updateRuntime(): void {
    if (!this.isConnected || this.#document === undefined) return;
    if (this.#document !== undefined) this.#registryFrozen = true;
    if (this.#runtime !== undefined) {
      this.#runtime.update(this.#configuration());
      return;
    }
    this.#clearRuntimeError();
    try {
      this.#runtime = this.mount(this.#configuration());
      this.#runtime.whenReady().catch(() => undefined);
    } catch (error: unknown) {
      this.#handleMountError(error);
    }
  }

  #restartRuntime(): void {
    this.#runtime?.dispose();
    this.#runtime = undefined;
    this.#clearRuntimeError();
    if (this.isConnected && this.#document !== undefined) this.#updateRuntime();
  }

  #handleMountError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'runtime mount failed';
    this.#runtimeErrorMessage.textContent = message;
    this.#runtimeError.hidden = false;
    dispatchScreenDynamicEvent(this, 'nebula-error', {
      operation: 'load',
      error: { code: 'RUNTIME_MOUNT_FAILED', message },
    });
  }

  #clearRuntimeError(): void {
    this.#runtimeError.hidden = true;
    this.#runtimeErrorMessage.textContent = '';
  }

  #applyTheme(): void {
    const dark = this.#theme === 'dark';
    this.style.setProperty('--nebula-screen-bg', dark ? '#0b1220' : '#f3f4f6');
    this.style.setProperty('--nebula-screen-fg', dark ? '#e5e7eb' : '#111827');
  }

  #observeSize(): void {
    const updateSize = (width: number, height: number): void => {
      this.#runtime?.resize(width, height);
    };
    const ResizeObserverConstructor = this.ownerDocument.defaultView?.ResizeObserver;
    if (ResizeObserverConstructor === undefined) return;
    this.#resizeObserver = new ResizeObserverConstructor((entries) => {
      const entry = entries[0];
      if (entry !== undefined) updateSize(entry.contentRect.width, entry.contentRect.height);
    });
    this.#resizeObserver.observe(this);
  }
}
