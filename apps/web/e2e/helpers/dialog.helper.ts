import { type Page, expect } from '@playwright/test';

export async function waitForDialogOpen(page: Page): Promise<void> {
  await expect(page.locator('[role="dialog"][data-state="open"]')).toBeVisible();
}

export async function waitForDialogClose(page: Page): Promise<void> {
  await expect(page.locator('[role="dialog"]')).toBeHidden();
}

export async function getDialogTitle(page: Page): Promise<string | null> {
  return page.locator('[role="dialog"][data-state="open"] h2').textContent();
}

export async function clickConfirmDelete(page: Page): Promise<void> {
  await page.locator('[role="alertdialog"]').getByRole('button', { name: '确认删除' }).click();
}

export async function clickCancelConfirm(page: Page): Promise<void> {
  await page.locator('[role="alertdialog"]').getByRole('button', { name: '取消' }).click();
}
