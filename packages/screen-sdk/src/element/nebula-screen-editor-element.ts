import {
  dispatchScreenEditorEvent,
  normalizeScreenAdapterError,
  ScreenAdapterErrorCode,
  toScreenPublicError,
  type ScreenAdapterError,
  type NebulaScreenEditorEventMap,
  type ScreenHostAdapter,
  type ScreenDocumentV1,
  type ScreenEditorTheme,
  type ScreenProjectDraft,
  type ScreenProjectEnvelope,
  type ScreenSdkDiagnostic,
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
  #adapter?: ScreenHostAdapter;
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

  get adapter(): ScreenHostAdapter | undefined {
    return this.#adapter;
  }

  set adapter(adapter: ScreenHostAdapter | undefined) {
    if (this.#adapter === adapter) return;
    this.#adapter = adapter;
    this.#updateRuntime();
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

  save(): Promise<ScreenProjectEnvelope> {
    return this.#awaitRuntime()
      .then((runtime) => runtime.save())
      .then((envelope) => structuredClone(envelope));
  }

  publish(): Promise<ScreenProjectEnvelope> {
    return this.#awaitRuntime()
      .then((runtime) => runtime.publish())
      .then((envelope) => structuredClone(envelope));
  }

  getDraft(): ScreenProjectDraft | null {
    const draft = this.#runtime?.getDraft() ?? null;
    return draft === null ? null : structuredClone(draft);
  }

  getDocument(): ScreenDocumentV1 | null {
    const document = this.#runtime?.getDocument() ?? null;
    return document === null ? null : structuredClone(document);
  }

  validate(): ScreenSdkDiagnostic[] {
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
    return {
      adapter: this.#adapter,
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
    if (this.#runtime !== undefined) {
      this.#runtime.update(this.#configuration());
      return;
    }
    this.#mountError = undefined;
    this.#clearRuntimeError();
    this.#pendingUpdate = this.#configuration();
    void this.#mountRuntime().catch(() => undefined);
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

  // Typed event listener overloads — declared on the class to provide
  // compile-time event names without unsafe declaration merging.
  addEventListener<EventName extends keyof NebulaScreenEditorEventMap>(
    type: EventName,
    listener: (
      this: NebulaScreenEditorElement,
      event: NebulaScreenEditorEventMap[EventName],
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

  removeEventListener<EventName extends keyof NebulaScreenEditorEventMap>(
    type: EventName,
    listener: (
      this: NebulaScreenEditorElement,
      event: NebulaScreenEditorEventMap[EventName],
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
