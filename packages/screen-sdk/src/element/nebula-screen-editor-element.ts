import type { ScreenHostAdapter } from '../contracts/adapter.js';
import { ScreenAdapterErrorCode, type ScreenAdapterError } from '../contracts/adapter.js';
import type {
  ScreenDocumentV1,
  ScreenProjectDraft,
  ScreenProjectEnvelope,
} from '../contracts/document.js';
import type { ScreenSdkDiagnostic } from '../contracts/diagnostics.js';
import type { NebulaScreenEditorEventMap } from '../events.js';
import screenEditorStyles from '../styles/screen-editor.css?inline';
import { installScreenEditorStyles } from '../styles/install-styles.js';
import { applyScreenEditorThemeVariables } from '../styles/theme.js';
import { mountNebulaScreenEditorRuntime } from './runtime-loader.js';
import type {
  ScreenEditorOptions,
  ScreenEditorRuntime,
  ScreenEditorRuntimeConfiguration,
  ScreenEditorTheme,
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
  #adapter?: ScreenHostAdapter;
  #options?: ScreenEditorOptions;
  #resizeObserver?: ResizeObserver;
  #runtime?: ScreenEditorRuntime;

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
    this.#sdkRoot.append(this.#mountRoot, this.#portalRoot, this.#sizeWarning);
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
    this.#mountRuntime();
    this.#observeSize();
  }

  disconnectedCallback(): void {
    this.removeEventListener('focusin', this.#activate);
    this.removeEventListener('pointerdown', this.#activate, true);
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    if (activeEditors.get(this.ownerDocument) === this) activeEditors.delete(this.ownerDocument);
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
    return this.#requireRuntime().whenReady();
  }

  reload(options?: { discardChanges?: boolean }): Promise<void> {
    return this.#requireRuntime().reload(options);
  }

  save(): Promise<ScreenProjectEnvelope> {
    return this.#requireRuntime()
      .save()
      .then((envelope) => structuredClone(envelope));
  }

  publish(): Promise<ScreenProjectEnvelope> {
    return this.#requireRuntime()
      .publish()
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

  #mountRuntime(): void {
    if (this.#runtime !== undefined || !this.isConnected) return;
    this.#runtime = mountNebulaScreenEditorRuntime({
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
  }

  #restartRuntime(): void {
    this.#runtime?.dispose();
    this.#runtime = undefined;
    this.#mountRuntime();
  }

  #updateRuntime(): void {
    if (!this.isConnected) return;
    this.#mountRuntime();
    this.#runtime?.update(this.#configuration());
  }

  #requireRuntime(): ScreenEditorRuntime {
    if (this.#runtime === undefined) {
      throw new ElementCommandError(ScreenAdapterErrorCode.UNAVAILABLE);
    }
    return this.#runtime;
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
      this.#runtime?.resize(width, height);
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
}

export interface NebulaScreenEditorElement {
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
}

declare global {
  interface HTMLElementTagNameMap {
    'nebula-screen-editor': NebulaScreenEditorElement;
  }
}
