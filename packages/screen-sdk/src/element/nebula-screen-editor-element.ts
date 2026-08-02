import {
  dispatchScreenEditorEvent,
  normalizeScreenAdapterError,
  resolveScreenComponentRegistryForRuntime,
  ScreenAdapterErrorCode,
  toScreenPublicError,
  type ScreenAdapterError,
  type ScreenEditorTheme,
  type ScreenHostAdapter,
  type ScreenHostAdapterV2,
  type ScreenSdkDiagnosticV2,
} from '@nebula/screen-editor-core';
import screenEditorStyles from '../styles/screen-editor.css?inline';
import { installScreenEditorStyles } from '../styles/install-styles.js';
import { applyScreenEditorThemeVariables } from '../styles/theme.js';
import { loadRuntimeMount } from './runtime-loader.js';
import type {
  ScreenEditorOptions,
  ScreenEditorRuntime,
  ScreenEditorRuntimeConfiguration,
} from './runtime.js';
import type {
  NebulaScreenEditorEventMapV2,
  ScreenComponentRegistry,
  ScreenEditorAdapterV2,
  ScreenSdkDocument,
  ScreenSdkProjectDraft,
  ScreenSdkProjectEnvelope,
} from './v2-contracts.js';

const MINIMUM_EDITOR_WIDTH = 1024;
const MINIMUM_EDITOR_HEIGHT = 640;
let instanceCounter = 0;
const activeEditors = new WeakMap<Document, NebulaScreenEditorElement>();

class ElementCommandError extends Error implements ScreenAdapterError {
  readonly code;
  readonly recoverable;

  constructor(code: ScreenAdapterError['code']) {
    super(code);
    this.name = 'ScreenAdapterError';
    this.code = code;
    this.recoverable = true;
  }
}

function cloneOptions(options: ScreenEditorOptions | undefined): ScreenEditorOptions {
  if (options === undefined) return {};
  return structuredClone(options);
}

export class NebulaScreenEditorElement extends HTMLElement {
  static readonly observedAttributes = ['project-id', 'readonly', 'theme'];

  readonly #instanceId = `nebula-screen-editor-${++instanceCounter}`;
  readonly #mountRoot: HTMLDivElement;
  readonly #portalRoot: HTMLDivElement;
  readonly #sdkRoot: HTMLDivElement;
  readonly #sizeWarning: HTMLDivElement;
  readonly #runtimeError: HTMLDivElement;
  readonly #runtimeErrorMessage: HTMLSpanElement;
  readonly #runtimeRetryButton: HTMLButtonElement;
  #adapter?: ScreenEditorAdapterV2;
  #componentRegistry?: ScreenComponentRegistry;
  #registryFrozen = false;
  #options?: ScreenEditorOptions;
  #resizeObserver?: ResizeObserver;
  #runtime?: ScreenEditorRuntime;
  #mountPromise?: Promise<void>;
  #mountError?: ScreenAdapterError;
  #pendingUpdate?: ScreenEditorRuntimeConfiguration;
  #pendingSize?: { width: number; height: number };

  readonly #retryRuntime = (): void => {
    this.#mountError = undefined;
    this.#clearRuntimeError();
    void this.#mountRuntime().catch(() => undefined);
  };

  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    installScreenEditorStyles(shadowRoot, screenEditorStyles);

    this.#sdkRoot = this.ownerDocument.createElement('div');
    this.#sdkRoot.dataset['nebulaSdkRoot'] = '';
    this.#mountRoot = this.ownerDocument.createElement('div');
    this.#mountRoot.dataset['nebulaReactRoot'] = '';
    this.#portalRoot = this.ownerDocument.createElement('div');
    this.#portalRoot.dataset['nebulaPortalRoot'] = '';
    this.#sizeWarning = this.ownerDocument.createElement('div');
    this.#sizeWarning.dataset['nebulaSizeWarning'] = '';
    this.#sizeWarning.textContent = '建议使用至少 1024 × 640 的容器以获得完整编辑体验。';
    this.#sizeWarning.hidden = true;
    this.#runtimeError = this.ownerDocument.createElement('div');
    this.#runtimeError.dataset['nebulaRuntimeError'] = '';
    this.#runtimeError.setAttribute('role', 'alert');
    this.#runtimeError.hidden = true;
    this.#runtimeErrorMessage = this.ownerDocument.createElement('span');
    this.#runtimeErrorMessage.dataset['nebulaRuntimeErrorMessage'] = '';
    this.#runtimeRetryButton = this.ownerDocument.createElement('button');
    this.#runtimeRetryButton.type = 'button';
    this.#runtimeRetryButton.textContent = '重试';
    this.#runtimeRetryButton.addEventListener('click', this.#retryRuntime);
    this.#runtimeError.append(this.#runtimeErrorMessage, this.#runtimeRetryButton);
    this.#sdkRoot.append(this.#mountRoot, this.#portalRoot, this.#sizeWarning, this.#runtimeError);
    shadowRoot.append(this.#sdkRoot);
  }

  get adapter(): ScreenEditorAdapterV2 | undefined {
    return this.#adapter;
  }

  set adapter(adapter: ScreenEditorAdapterV2 | undefined) {
    if (this.#adapter === adapter) return;
    this.#adapter = adapter;
    this.#updateRuntime();
  }

  get componentRegistry(): ScreenComponentRegistry | undefined {
    return this.#componentRegistry;
  }

  set componentRegistry(registry: ScreenComponentRegistry | undefined) {
    if (this.#registryFrozen) {
      throw new DOMException(
        'componentRegistry is frozen after load has started; create a new element to use a different registry.',
        'InvalidStateError',
      );
    }
    if (this.#componentRegistry === registry) return;
    this.#componentRegistry = registry;
  }

  get options(): ScreenEditorOptions | undefined {
    return this.#options === undefined ? undefined : cloneOptions(this.#options);
  }

  set options(options: ScreenEditorOptions | undefined) {
    if (this.#options === options) return;
    this.#options = options === undefined ? undefined : cloneOptions(options);
    if (this.isConnected) this.#restartRuntime();
  }

  get projectId(): string {
    return this.getAttribute('project-id') ?? '';
  }

  set projectId(projectId: string) {
    if (projectId === '') {
      this.removeAttribute('project-id');
      return;
    }
    if (this.getAttribute('project-id') !== projectId) this.setAttribute('project-id', projectId);
  }

  get readonly(): boolean {
    return this.hasAttribute('readonly');
  }

  set readonly(readonly: boolean) {
    this.toggleAttribute('readonly', readonly);
  }

  get theme(): ScreenEditorTheme {
    return this.getAttribute('theme') === 'dark' ? 'dark' : 'light';
  }

  set theme(theme: ScreenEditorTheme) {
    if (this.getAttribute('theme') !== theme) this.setAttribute('theme', theme);
  }

  connectedCallback(): void {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.addEventListener('focusin', this.#activate);
    this.addEventListener('pointerdown', this.#activate, true);
    this.#activate();
    this.#applyTheme();
    this.#mountError = undefined;
    void this.#mountRuntime().catch(() => undefined);
    this.#observeSize();
  }

  disconnectedCallback(): void {
    this.removeEventListener('focusin', this.#activate);
    this.removeEventListener('pointerdown', this.#activate, true);
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    if (activeEditors.get(this.ownerDocument) === this) activeEditors.delete(this.ownerDocument);
    this.#mountPromise = undefined;
    this.#mountError = undefined;
    this.#pendingUpdate = undefined;
    this.#pendingSize = undefined;
    this.#runtime?.dispose();
    this.#runtime = undefined;
  }

  attributeChangedCallback(
    name: string,
    previousValue: string | null,
    nextValue: string | null,
  ): void {
    if (previousValue === nextValue) return;
    if (name === 'theme') this.#applyTheme();
    this.#updateRuntime();
  }

  whenReady(): Promise<void> {
    return this.#awaitRuntime().then((runtime) => runtime.whenReady());
  }

  reload(options?: { discardChanges?: boolean }): Promise<void> {
    if (this.#runtime === undefined && this.#mountError !== undefined) {
      this.#mountError = undefined;
      this.#clearRuntimeError();
    }
    return this.#awaitRuntime().then((runtime) => runtime.reload(options));
  }

  save(): Promise<ScreenSdkProjectEnvelope> {
    return this.#awaitRuntime()
      .then((runtime) => runtime.save())
      .then((envelope) => structuredClone(envelope));
  }

  publish(): Promise<ScreenSdkProjectEnvelope> {
    return this.#awaitRuntime()
      .then((runtime) => runtime.publish())
      .then((envelope) => structuredClone(envelope));
  }

  getDraft(): ScreenSdkProjectDraft | null {
    const draft = this.#runtime?.getDraft() ?? null;
    return draft === null ? null : structuredClone(draft);
  }

  getDocument(): ScreenSdkDocument | null {
    const document = this.#runtime?.getDocument() ?? null;
    return document === null ? null : structuredClone(document);
  }

  validate(): ScreenSdkDiagnosticV2[] {
    return structuredClone(this.#runtime?.validate() ?? []);
  }

  undo(): void {
    if (!this.readonly) this.#runtime?.undo();
  }

  redo(): void {
    if (!this.readonly) this.#runtime?.redo();
  }

  fitToScreen(): void {
    this.#runtime?.fitToScreen();
  }

  focusComponent(componentId: string): boolean {
    return this.#runtime?.focusComponent(componentId) ?? false;
  }

  readonly #activate = (): void => {
    activeEditors.set(this.ownerDocument, this);
  };

  #configuration(): ScreenEditorRuntimeConfiguration {
    const adapter = this.#adapter;
    const isRejectedCombo =
      adapter !== undefined && this.#hasHostRegistry() && !this.#isV2Adapter(adapter);
    const v2Adapter =
      adapter !== undefined && this.#isV2Adapter(adapter) && this.#componentRegistry !== undefined
        ? adapter
        : undefined;
    const v1Adapter =
      adapter !== undefined && !isRejectedCombo && !this.#isV2Adapter(adapter)
        ? adapter
        : undefined;
    return {
      adapter: v1Adapter,
      ...(v2Adapter === undefined ? {} : { adapterV2: v2Adapter }),
      // Task 6.2: registry is part of runtime configuration so it is ready
      // before React mount. Public facades resolve to the matching core snapshot;
      // direct internal registries remain supported for workspace hosts.
      componentRegistry: resolveScreenComponentRegistryForRuntime(this.#componentRegistry),
      documentMode: v2Adapter === undefined ? 'v1' : 'v2',
      options: {
        debug: this.#options?.debug ?? false,
        persistPreferences: this.#options?.persistPreferences ?? true,
        preferenceNamespace: this.#options?.preferenceNamespace ?? 'nebula:screen-sdk:v1',
      },
      projectId: this.projectId,
      readonly: this.readonly,
      theme: this.theme,
    };
  }

  #mountRuntime(): Promise<void> {
    if (this.#runtime !== undefined || !this.isConnected) return Promise.resolve();
    if (this.#mountPromise !== undefined) return this.#mountPromise;
    this.#clearRuntimeError();
    const promise = loadRuntimeMount()
      .then((mount) => {
        if (this.#mountPromise !== promise || !this.isConnected) return;
        this.#runtime = mount({
          ...this.#configuration(),
          eventTarget: this,
          identifierPrefix: `${this.#instanceId}-`,
          isActive: () => activeEditors.get(this.ownerDocument) === this,
          mountRoot: this.#mountRoot,
          onThemeChange: (theme) => {
            this.theme = theme;
          },
          portalRoot: this.#portalRoot,
        });
        this.#mountPromise = undefined;
        this.#mountError = undefined;
        if (this.#pendingUpdate !== undefined) {
          this.#runtime.update(this.#pendingUpdate);
          this.#pendingUpdate = undefined;
        }
        if (this.#pendingSize !== undefined) {
          this.#runtime.resize(this.#pendingSize.width, this.#pendingSize.height);
          this.#pendingSize = undefined;
        }
      })
      .catch((error: unknown) => {
        if (this.#mountPromise !== promise || !this.isConnected) return;
        const normalized = normalizeScreenAdapterError(error);
        const publicError = { ...toScreenPublicError(normalized), recoverable: true };
        this.#mountPromise = undefined;
        this.#mountError = normalized;
        this.#runtimeErrorMessage.textContent = publicError.message;
        this.#runtimeError.hidden = false;
        dispatchScreenEditorEvent(this, 'nebula-error', {
          ...(this.projectId === '' ? {} : { projectId: this.projectId }),
          operation: 'load',
          error: publicError,
        });
        throw normalized;
      });
    this.#mountPromise = promise;
    return promise;
  }

  #awaitRuntime(): Promise<ScreenEditorRuntime> {
    if (this.#runtime !== undefined) return Promise.resolve(this.#runtime);
    if (!this.isConnected)
      return Promise.reject(new ElementCommandError(ScreenAdapterErrorCode.UNAVAILABLE));
    if (this.#mountError !== undefined) return Promise.reject(this.#mountError);
    return this.#mountRuntime().then(() => {
      if (this.#runtime === undefined) {
        throw new ElementCommandError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      return this.#runtime;
    });
  }

  #restartRuntime(): void {
    this.#runtime?.dispose();
    this.#runtime = undefined;
    this.#mountPromise = undefined;
    this.#mountError = undefined;
    this.#pendingUpdate = undefined;
    this.#pendingSize = undefined;
    this.#clearRuntimeError();
    void this.#mountRuntime().catch(() => undefined);
  }

  #updateRuntime(): void {
    if (!this.isConnected) return;

    const adapter = this.#adapter;
    const willLoad = adapter !== undefined && this.projectId !== '';

    if (willLoad) {
      // Spec §8.5: freeze registry on first load start; no hot replacement.
      // Freeze happens before rejection so post-rejection replacement is also blocked.
      this.#registryFrozen = true;
      // Requirement 13: external registry + V1 adapter rejection before load.
      // V2 adapter is identified by `documentVersion: 2` marker (Spec §12.3).
      if (this.#hasHostRegistry() && !this.#isV2Adapter(adapter)) {
        this.#rejectAdapterRegistryCombo();
        return;
      }
      if (this.#isV2Adapter(adapter) && this.#componentRegistry === undefined) {
        this.#rejectV2AdapterWithoutRegistry();
        return;
      }
    }

    if (this.#runtime !== undefined) {
      this.#runtime.update(this.#configuration());
      return;
    }
    this.#mountError = undefined;
    this.#clearRuntimeError();
    this.#pendingUpdate = this.#configuration();
    void this.#mountRuntime().catch(() => undefined);
  }

  /**
   * V2 adapter type guard (Spec §12.3).
   * `ScreenHostAdapterV2` has `documentVersion: 2` as a runtime capability marker.
   */
  #isV2Adapter(adapter: ScreenHostAdapter | ScreenHostAdapterV2): adapter is ScreenHostAdapterV2 {
    return (
      typeof adapter === 'object' &&
      adapter !== null &&
      'documentVersion' in adapter &&
      adapter.documentVersion === 2
    );
  }

  /**
   * Checks if the current registry contains any host-registered (external) components.
   * External components require a V2 adapter (Requirement 13).
   */
  #hasHostRegistry(): boolean {
    const registry = this.#componentRegistry;
    if (registry === undefined) return false;
    return registry.list().some((reg) => reg.source === 'host');
  }

  /**
   * Rejects the external registry + V1 adapter combination before load (Requirement 13).
   * Dispatches `nebula-error` with `VALIDATION` code and displays the runtime error UI.
   * Does not call the Adapter or create a partial editing session.
   */
  #rejectAdapterRegistryCombo(): void {
    const error = new ElementCommandError(ScreenAdapterErrorCode.VALIDATION);
    const publicError = toScreenPublicError(error);
    this.#mountError = error;
    this.#runtimeErrorMessage.textContent = publicError.message;
    this.#runtimeError.hidden = false;
    dispatchScreenEditorEvent(this, 'nebula-error', {
      ...(this.projectId === '' ? {} : { projectId: this.projectId }),
      operation: 'load',
      error: publicError,
    });
  }

  /** V2 adapters require an explicit registry facade to select the V2 runtime. */
  #rejectV2AdapterWithoutRegistry(): void {
    const error = new ElementCommandError(ScreenAdapterErrorCode.VALIDATION);
    const publicError = toScreenPublicError(error);
    this.#mountError = error;
    this.#runtimeErrorMessage.textContent = publicError.message;
    this.#runtimeError.hidden = false;
    dispatchScreenEditorEvent(this, 'nebula-error', {
      ...(this.projectId === '' ? {} : { projectId: this.projectId }),
      operation: 'load',
      error: publicError,
    });
  }

  #clearRuntimeError(): void {
    this.#runtimeError.hidden = true;
    this.#runtimeErrorMessage.textContent = '';
  }

  #applyTheme(): void {
    const dark = this.theme === 'dark';
    this.#sdkRoot.classList.toggle('dark', dark);
    applyScreenEditorThemeVariables(
      this,
      [this.#sdkRoot, this.#mountRoot, this.#portalRoot],
      this.theme,
    );
  }

  #observeSize(): void {
    const updateSize = (width: number, height: number): void => {
      this.#sizeWarning.hidden = width >= MINIMUM_EDITOR_WIDTH && height >= MINIMUM_EDITOR_HEIGHT;
      if (this.#runtime !== undefined) {
        this.#runtime.resize(width, height);
      } else {
        this.#pendingSize = { width, height };
      }
      this.#applyTheme();
    };
    const ResizeObserverConstructor = this.ownerDocument.defaultView?.ResizeObserver;
    if (ResizeObserverConstructor === undefined) {
      const rect = this.getBoundingClientRect();
      updateSize(rect.width, rect.height);
      return;
    }
    this.#resizeObserver = new ResizeObserverConstructor((entries) => {
      const entry = entries[0];
      if (entry !== undefined) updateSize(entry.contentRect.width, entry.contentRect.height);
    });
    this.#resizeObserver.observe(this);
  }

  // Typed event listener overloads (Spec §14.1: V2 event map).
  // V1 event payloads are structurally compatible with V2 (V1 is a subset of V2),
  // so V2 listeners accept both V1 and V2 dispatched events.
  addEventListener<EventName extends keyof NebulaScreenEditorEventMapV2>(
    type: EventName,
    listener: (
      this: NebulaScreenEditorElement,
      event: NebulaScreenEditorEventMapV2[EventName],
    ) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (listener !== null) super.addEventListener(type, listener, options);
  }

  removeEventListener<EventName extends keyof NebulaScreenEditorEventMapV2>(
    type: EventName,
    listener: (
      this: NebulaScreenEditorElement,
      event: NebulaScreenEditorEventMapV2[EventName],
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (listener !== null) super.removeEventListener(type, listener, options);
  }
}
