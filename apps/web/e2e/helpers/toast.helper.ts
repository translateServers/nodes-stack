import { type Page, expect } from '@playwright/test';

export async function waitForSuccessToast(page: Page, message?: string): Promise<void> {
  const toast = page.locator('[data-sonner-toaster] li[data-type="success"]');
  if (message) {
    await expect(toast.filter({ hasText: message })).toBeVisible();
  } else {
    await expect(toast.first()).toBeVisible();
  }
}

export async function waitForErrorToast(page: Page, message?: string): Promise<void> {
  const toast = page.locator('[data-sonner-toaster] li[data-type="error"]');
  if (message) {
    await expect(toast.filter({ hasText: message })).toBeVisible();
  } else {
    await expect(toast.first()).toBeVisible();
  }
}

export async function assertNoToasts(page: Page): Promise<void> {
  const toasts = page.locator('[data-sonner-toaster] li');
  await expect(toasts).toHaveCount(0);
}
