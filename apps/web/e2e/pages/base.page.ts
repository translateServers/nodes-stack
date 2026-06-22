import { type Page, expect } from '@playwright/test';

export abstract class BasePage {
  protected abstract readonly path: string;

  constructor(protected readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(this.path);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForPageReady(): Promise<void> {
    await expect(this.page.locator('nav')).toBeVisible();
  }

  async getPageTitle(): Promise<string> {
    return (await this.page.locator('h1').textContent()) ?? '';
  }

  async isLoggedIn(): Promise<boolean> {
    return this.page.locator('nav').isVisible();
  }

  getCurrentUrl(): string {
    return this.page.url();
  }
}
