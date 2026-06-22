import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import {
  waitForDialogOpen,
  waitForDialogClose,
  clickConfirmDelete,
  clickCancelConfirm,
} from '../helpers/dialog.helper';
import { assertRowExists, assertRowNotExists, findRowByText } from '../helpers/table.helper';

interface CreateRoleData {
  name: string;
  description?: string;
}

interface UpdateRoleData {
  name?: string;
  description?: string;
}

export class RolesPage extends BasePage {
  protected readonly path = '/roles';

  private readonly createButton: Locator;
  private readonly searchInput: Locator;
  private readonly table: Locator;
  private readonly dialog: Locator;

  constructor(page: Page) {
    super(page);
    this.createButton = page.getByRole('button', { name: /新建角色/ });
    this.searchInput = page.getByPlaceholder('搜索角色名称');
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

  async fillCreateForm(data: CreateRoleData): Promise<void> {
    const form = this.dialog.locator('form');
    await form.locator('#name').fill(data.name);
    if (data.description) {
      await form.locator('#description').fill(data.description);
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

  async createRole(data: CreateRoleData): Promise<void> {
    await this.openCreateDialog();
    await this.fillCreateForm(data);
    await this.submitForm();
    await this.waitForTableRefresh();
  }

  async getRowCount(): Promise<number> {
    return this.table.locator('tbody tr').count();
  }

  async assertRoleExists(name: string): Promise<void> {
    await assertRowExists(this.table, name);
  }

  async assertRoleNotExists(name: string): Promise<void> {
    await assertRowNotExists(this.table, name);
  }

  async searchFor(text: string): Promise<void> {
    await this.searchInput.fill(text);
    await expect(this.table.locator('tbody tr').first()).toBeVisible();
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
  }

  async clickEdit(name: string): Promise<void> {
    const row = findRowByText(this.table, name).first();
    const actionsCell = row.locator('td').last();
    await actionsCell.locator('button').first().click();
    await waitForDialogOpen(this.page);
  }

  async fillEditForm(data: UpdateRoleData): Promise<void> {
    const form = this.dialog.locator('form');
    if (data.name) {
      await form.locator('#name').fill(data.name);
    }
    if (data.description) {
      await form.locator('#description').fill(data.description);
    }
  }

  async editRole(name: string, data: UpdateRoleData): Promise<void> {
    await this.clickEdit(name);
    await this.fillEditForm(data);
    await this.submitForm();
    await this.waitForTableRefresh();
  }

  async clickDelete(name: string): Promise<void> {
    const row = findRowByText(this.table, name).first();
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
