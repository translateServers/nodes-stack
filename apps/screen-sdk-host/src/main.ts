import '@nebula/screen-sdk/auto-register';
import type {
  NebulaScreenEditorElement,
  NebulaScreenEditorEventMap,
  ScreenProjectTransferV1,
} from '@nebula/screen-sdk';
import { createFixtureProjects } from './fixtures';
import {
  InMemoryScreenHostAdapter,
  type InMemoryMutationOperation,
  type InMemoryOperationLogEntry,
} from './in-memory-adapter';
import './host.css';

type HostScenario = 'dual' | 'hostile' | 'single' | 'small';

const EVENT_NAMES = [
  'nebula-ready',
  'nebula-change',
  'nebula-dirty-change',
  'nebula-selection-change',
  'nebula-save-success',
  'nebula-publish-success',
  'nebula-operation-success',
  'nebula-preview-request',
  'nebula-navigate-request',
  'nebula-error',
] as const satisfies readonly (keyof NebulaScreenEditorEventMap)[];

interface ScreenSdkHostTestApi {
  createTransfer(editorIndex?: number): ScreenProjectTransferV1;
  forceConflict(operation: InMemoryMutationOperation, editorIndex?: number): void;
  getEditor(editorIndex?: number): NebulaScreenEditorElement;
  getOperationLog(): InMemoryOperationLogEntry[];
  remount(editorIndex?: number): Promise<void>;
}

declare global {
  interface Window {
    __screenSdkHost: ScreenSdkHostTestApi;
  }
}

function requiredElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (element === null) throw new Error(`Missing host element: ${selector}`);
  return element;
}

function readScenario(): HostScenario {
  const scenario = new URLSearchParams(window.location.search).get('scenario');
  return scenario === 'dual' || scenario === 'hostile' || scenario === 'small'
    ? scenario
    : 'single';
}

const scenario = readScenario();
const adapter = new InMemoryScreenHostAdapter(createFixtureProjects());
const stage = requiredElement<HTMLElement>('#editor-stage');
const status = requiredElement<HTMLElement>('#host-status');
const eventLog = requiredElement<HTMLOListElement>('#event-log');
const operationCount = requiredElement<HTMLElement>('#operation-count');
const scenarioSelect = requiredElement<HTMLSelectElement>('#scenario-select');
const editors: NebulaScreenEditorElement[] = [];
let activeEditorIndex = 0;
let darkTheme = false;

document.body.dataset['scenario'] = scenario;
scenarioSelect.value = scenario;
stage.classList.toggle('dual', scenario === 'dual');
stage.classList.toggle('small', scenario === 'small');

function renderActiveIndicators(): void {
  document.querySelectorAll<HTMLElement>('[data-active-indicator]').forEach((indicator, index) => {
    indicator.textContent = index === activeEditorIndex ? 'ACTIVE' : '';
  });
}

function summarizeDetail(detail: unknown): string {
  if (typeof detail !== 'object' || detail === null) return '';
  const record = detail as Record<string, unknown>;
  const projectId = typeof record['projectId'] === 'string' ? record['projectId'] : undefined;
  const operation = typeof record['operation'] === 'string' ? record['operation'] : undefined;
  const error =
    typeof record['error'] === 'object' && record['error'] !== null
      ? (record['error'] as Record<string, unknown>)['code']
      : undefined;
  return [projectId, operation, typeof error === 'string' ? error : undefined]
    .filter((value): value is string => value !== undefined)
    .join(' · ');
}

function appendEvent(eventName: string, detail: unknown): void {
  const item = document.createElement('li');
  const heading = document.createElement('strong');
  heading.textContent = eventName;
  item.append(heading, document.createTextNode(summarizeDetail(detail)));
  eventLog.prepend(item);
  while (eventLog.childElementCount > 40) eventLog.lastElementChild?.remove();
}

function renderOperationCount(): void {
  operationCount.textContent = String(adapter.getOperationLog().length);
}

adapter.subscribe(renderOperationCount);

function registerEditorEvents(editor: NebulaScreenEditorElement): void {
  for (const eventName of EVENT_NAMES) {
    editor.addEventListener(eventName, (event) => {
      appendEvent(eventName, event.detail);
      if (eventName === 'nebula-ready') status.textContent = `${editor.projectId} 已就绪`;
      if (eventName === 'nebula-preview-request')
        status.textContent = `${editor.projectId} 预览请求`;
    });
  }
}

function createEditor(projectId: string, index: number): NebulaScreenEditorElement {
  const shell = document.createElement('article');
  shell.className = 'editor-shell';
  shell.dataset['editorShell'] = projectId;
  const label = document.createElement('div');
  label.className = 'editor-label';
  const projectLabel = document.createElement('span');
  projectLabel.textContent = projectId;
  const activeIndicator = document.createElement('span');
  activeIndicator.dataset['activeIndicator'] = '';
  label.append(projectLabel, activeIndicator);

  const editor = document.createElement('nebula-screen-editor');
  editor.dataset['editorIndex'] = String(index);
  editor.adapter = adapter;
  editor.options = {
    debug: false,
    persistPreferences: false,
    preferenceNamespace: `nebula:screen-sdk-host:${projectId}`,
  };
  editor.projectId = projectId;
  editor.theme = darkTheme ? 'dark' : 'light';
  editor.addEventListener('pointerdown', () => {
    activeEditorIndex = index;
    renderActiveIndicators();
  });
  registerEditorEvents(editor);
  shell.append(label, editor);
  stage.append(shell);
  return editor;
}

editors.push(createEditor('project-a', 0));
if (scenario === 'dual') editors.push(createEditor('project-b', 1));
renderActiveIndicators();

function getEditor(editorIndex = activeEditorIndex): NebulaScreenEditorElement {
  const editor = editors[editorIndex];
  if (editor === undefined) throw new Error(`Editor ${editorIndex} is not mounted`);
  return editor;
}

async function runCommand(
  name: string,
  command: (editor: NebulaScreenEditorElement) => Promise<unknown>,
): Promise<void> {
  const editor = getEditor();
  status.textContent = `${name}中`;
  try {
    await command(editor);
    status.textContent = `${editor.projectId} ${name}成功`;
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : 'UNKNOWN';
    status.textContent = `${editor.projectId} ${name}失败：${code}`;
  }
}

async function remountEditor(editorIndex = activeEditorIndex): Promise<void> {
  const editor = getEditor(editorIndex);
  const parent = editor.parentElement;
  if (parent === null) throw new Error('Editor shell is missing');
  editor.remove();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
  parent.append(editor);
  await editor.whenReady();
}

requiredElement<HTMLButtonElement>('#save-command').addEventListener('click', () => {
  void runCommand('保存', (editor) => editor.save());
});

requiredElement<HTMLButtonElement>('#publish-command').addEventListener('click', () => {
  void runCommand('发布', (editor) => editor.publish());
});

requiredElement<HTMLButtonElement>('#conflict-command').addEventListener('click', () => {
  const editor = getEditor();
  adapter.forceConflict('save', editor.projectId);
  status.textContent = `${editor.projectId} 下次保存将冲突`;
});

requiredElement<HTMLButtonElement>('#theme-command').addEventListener('click', () => {
  darkTheme = !darkTheme;
  for (const editor of editors) editor.theme = darkTheme ? 'dark' : 'light';
  status.textContent = darkTheme ? '深色主题' : '浅色主题';
});

requiredElement<HTMLButtonElement>('#remount-command').addEventListener('click', () => {
  void remountEditor().catch((error: unknown) => {
    status.textContent = error instanceof Error ? error.message : '重新挂载失败';
  });
});

scenarioSelect.addEventListener('change', () => {
  const url = new URL(window.location.href);
  url.searchParams.set('scenario', scenarioSelect.value);
  window.location.assign(url);
});

window.__screenSdkHost = {
  createTransfer: (editorIndex) => adapter.createTransfer(getEditor(editorIndex).projectId),
  forceConflict: (operation, editorIndex) =>
    adapter.forceConflict(operation, getEditor(editorIndex).projectId),
  getEditor,
  getOperationLog: () => adapter.getOperationLog(),
  remount: remountEditor,
};

void Promise.all(editors.map((editor) => editor.whenReady())).then(
  () => {
    status.textContent = editors.length === 1 ? '参考宿主已就绪' : '双实例已就绪';
  },
  () => {
    status.textContent = '参考宿主加载失败';
  },
);
