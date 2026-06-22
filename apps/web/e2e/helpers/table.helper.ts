import { type Locator, expect } from '@playwright/test';

export async function getRowCount(table: Locator): Promise<number> {
  return table.locator('tbody tr').count();
}

export function findRowByText(table: Locator, text: string): Locator {
  return table.locator('tbody tr').filter({ hasText: text });
}

export async function assertRowExists(table: Locator, text: string): Promise<void> {
  await expect(findRowByText(table, text).first()).toBeVisible();
}

export async function assertRowNotExists(table: Locator, text: string): Promise<void> {
  await expect(findRowByText(table, text)).toHaveCount(0);
}

export async function getCellText(row: Locator, colIndex: number): Promise<string | null> {
  return row.locator('td').nth(colIndex).textContent();
}
