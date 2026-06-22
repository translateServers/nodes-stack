import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import {
  waitForDialogOpen,
  waitForDialogClose,
  clickConfirmDelete,
  clickCancelConfirm,
} from '../helpers/dialog.helper';
import { assertRowExists, assertRowNotExists, findRowByText } from '../helpers/table.helper';

interface CreateUserData {
  username: string;
  email: string;
  password: string;
  name?: string;
}

interface UpdateUserData {
  username?: string;
  email?: string;
  name?: string;
}

export class UsersPage extends BasePage {
  protected readonly path = '/users';

  private readonly createButton: Locator;
  private readonly searchInput: Locator;
  private readonly table: Locator;
  private readonly dialog: Locator;

  constructor(page: Page) {
    super(page);
    this.createButton = page.getByRole('button', { name: /新建用户/ });
    this.searchInput = page.getByPlaceholder('搜索用户名或邮箱');
    this.table = page.locator('table');
    this.dialog = page.locator('[role="dialog"]');
  }

  async waitForTableLoaded(): Promise<void> {
    await expect(this.table.locator('tbody')).toBeVisible();
  }

  async openCreateDialog(): Promise<void> {
    await this.createButton.first().click();
    await waitForDialogOpen(this.page);
  }

  async fillCreateForm(data: CreateUserData): Promise<void> {
    const form = this.dialog.locator('form');
    await form.locator('#username').fill(data.username);
    await form.locator('#email').fill(data.email);
    await form.locator('#password').fill(data.password);
    if (data.name) {
      await form.locator('#name').fill(data.name);
    }
  }

  async submitForm(): Promise<void> {
    await this.dialog
      .locator('form')
      .getByRole('button', { name: /创建|更新/ })
      .click();
    await waitForDialogClose(this.page);
  }

  async waitForTableRefresh(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async createUser(data: CreateUserData): Promise<void> {
    await this.openCreateDialog();
    await this.fillCreateForm(data);
    await this.submitForm();
    await this.waitForTableRefresh();
  }

  async getRowCount(): Promise<number> {
    return this.table.locator('tbody tr').count();
  }

  async assertUserExists(username: string): Promise<void> {
    await assertRowExists(this.table, username);
  }

  async assertUserNotExists(username: string): Promise<void> {
    await assertRowNotExists(this.table, username);
  }

  async searchFor(text: string): Promise<void> {
    await this.searchInput.fill(text);
    // 等待表格更新（TanStack Table 客户端过滤是同步的）
    await expect(this.table.locator('tbody tr').first()).toBeVisible();
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
  }

  async clickEdit(username: string): Promise<void> {
    const row = findRowByText(this.table, username).first();
    const actionsCell = row.locator('td').last();
    await actionsCell.locator('button').first().click();
    await waitForDialogOpen(this.page);
  }

  async fillEditForm(data: UpdateUserData): Promise<void> {
    const form = this.dialog.locator('form');
    if (data.username) {
      await form.locator('#username').fill(data.username);
    }
    if (data.email) {
      await form.locator('#email').fill(data.email);
    }
    if (data.name) {
      await form.locator('#name').fill(data.name);
    }
  }

  async editUser(username: string, data: UpdateUserData): Promise<void> {
    await this.clickEdit(username);
    await this.fillEditForm(data);
    await this.submitForm();
    await this.waitForTableRefresh();
  }

  async clickDelete(username: string): Promise<void> {
    const row = findRowByText(this.table, username).first();
    const actionsCell = row.locator('td').last();
    await actionsCell.locator('button').nth(1).click();
    await expect(this.page.locator('[role="alertdialog"]')).toBeVisible();
  }

  async confirmDelete(): Promise<void> {
    await clickConfirmDelete(this.page);
    await this.waitForTableRefresh();
  }

  async cancelDelete(): Promise<void> {
    await clickCancelConfirm(this.page);
  }
}
