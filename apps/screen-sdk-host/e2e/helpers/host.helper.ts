import type { Locator, Page } from '@playwright/test';
import type { ScreenProjectDraft, ScreenProjectTransfer } from '@nebula/screen-sdk';

export interface HostOperationLogEntry {
  operation: string;
  projectId: string;
  sequence: number;
}

interface BrowserHostApi {
  createTransfer(editorIndex?: number): ScreenProjectTransfer;
  forceConflict(
    operation: 'import' | 'publish' | 'save' | 'snapshot-restore',
    editorIndex?: number,
  ): void;
  getEditor(editorIndex?: number): {
    getDraft(): ScreenProjectDraft | null;
  };
  getOperationLog(): HostOperationLogEntry[];
  remount(editorIndex?: number): Promise<void>;
}

declare global {
  interface Window {
    __screenSdkHost: BrowserHostApi;
  }
}

export function getEditor(page: Page, index = 0): Locator {
  return page.locator('nebula-screen-editor').nth(index);
}

export async function waitForEditor(page: Page, index = 0): Promise<Locator> {
  const editor = getEditor(page, index);
  await editor.getByTestId('canvas-surface').waitFor({ state: 'visible' });
  return editor;
}

export async function getOperationLog(page: Page): Promise<HostOperationLogEntry[]> {
  return page.evaluate(() => window.__screenSdkHost.getOperationLog());
}

export async function waitForOperation(
  page: Page,
  operation: string,
  projectId?: string,
): Promise<void> {
  await page.waitForFunction(
    ({ expectedOperation, expectedProjectId }) =>
      window.__screenSdkHost
        .getOperationLog()
        .some(
          (entry) =>
            entry.operation === expectedOperation &&
            (expectedProjectId === undefined || entry.projectId === expectedProjectId),
        ),
    { expectedOperation: operation, expectedProjectId: projectId },
  );
}

export async function forceConflict(
  page: Page,
  operation: 'import' | 'publish' | 'save' | 'snapshot-restore',
  editorIndex = 0,
): Promise<void> {
  await page.evaluate(
    ({ nextOperation, index }) => window.__screenSdkHost.forceConflict(nextOperation, index),
    { nextOperation: operation, index: editorIndex },
  );
}

export async function createTransfer(page: Page, editorIndex = 0): Promise<ScreenProjectTransfer> {
  return page.evaluate((index) => window.__screenSdkHost.createTransfer(index), editorIndex);
}

export async function getDraft(page: Page, editorIndex = 0): Promise<ScreenProjectDraft | null> {
  return page.evaluate((index) => window.__screenSdkHost.getEditor(index).getDraft(), editorIndex);
}

export async function remountEditor(page: Page, editorIndex = 0): Promise<void> {
  await page.evaluate((index) => window.__screenSdkHost.remount(index), editorIndex);
}
