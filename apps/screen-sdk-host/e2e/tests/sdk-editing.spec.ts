import { expect, test, type Locator, type Page } from '@playwright/test';
import { getDraft, waitForEditor } from '../helpers/host.helper';

const COMPONENTS = [
  { id: 'project-a-text', initialWidth: 520 },
  { id: 'project-a-bar-chart', initialWidth: 620 },
  { id: 'project-a-rect', initialWidth: 260 },
  { id: 'project-a-ellipse', initialWidth: 180 },
  { id: 'project-a-image', initialWidth: 260 },
  { id: 'project-a-button', initialWidth: 180 },
] as const;

async function setSelectedWidth(editor: Locator, width: number): Promise<void> {
  const field = editor.getByText('宽', { exact: true }).locator('..').getByRole('textbox');
  await field.fill(String(width));
  await field.press('Enter');
}

async function componentWidth(page: Page, componentId: string): Promise<number | undefined> {
  return (await getDraft(page))?.document.components.find(
    (component) => component.id === componentId,
  )?.position.width;
}

async function insertBlueprintNode(
  sheet: Locator,
  optionId: string,
  position: { x: number; y: number },
): Promise<void> {
  await sheet.getByTestId('blueprint-canvas').dblclick({ position });
  const searchPanel = sheet.getByTestId('blueprint-search-panel');
  await expect(searchPanel).toBeVisible();
  await searchPanel.locator(`[data-option-id="${optionId}"]`).click();
}

test.describe('SDK editing workflows', () => {
  test('edits all six component types and exercises layers plus history', async ({ page }) => {
    await page.goto('/?scenario=single');
    const editor = await waitForEditor(page);

    for (const [index, component] of COMPONENTS.entries()) {
      const nextWidth = component.initialWidth + index + 11;
      await editor.locator(`[data-component-id="${component.id}"]`).click();
      await setSelectedWidth(editor, nextWidth);
      await expect.poll(() => componentWidth(page, component.id)).toBe(nextWidth);
    }

    const lastComponent = COMPONENTS.at(-1);
    if (lastComponent === undefined) throw new Error('Component fixture is empty');
    const editedWidth = lastComponent.initialWidth + COMPONENTS.length - 1 + 11;

    await editor.getByRole('button', { name: '撤销' }).click();
    await expect
      .poll(() => componentWidth(page, lastComponent.id))
      .toBe(lastComponent.initialWidth);
    await editor.getByRole('button', { name: '重做' }).click();
    await expect.poll(() => componentWidth(page, lastComponent.id)).toBe(editedWidth);

    await editor.getByRole('tab', { name: '图层', exact: true }).click();
    await expect(editor.getByTestId('layer-row')).toHaveCount(COMPONENTS.length);
    for (const name of ['标题文字', '季度销售额', '指标底板', '状态圆', '品牌图形', '查看详情']) {
      await expect(editor.getByTestId('layer-row').filter({ hasText: name })).toHaveCount(1);
    }
  });

  test('@release edits condition, delay, and comment nodes with static actions', async ({
    page,
  }) => {
    await page.goto('/?scenario=single');
    const editor = await waitForEditor(page);

    await editor.getByRole('button', { name: '工具' }).click();
    await editor.getByRole('menuitem', { name: /^事件蓝图/ }).click();
    const sheet = editor.getByRole('dialog', { name: '事件蓝图' });
    await expect(sheet).toBeVisible();
    await sheet.getByTestId('blueprint-start-from-scratch').click();

    await insertBlueprintNode(sheet, 'condition', { x: 220, y: 180 });
    await sheet.getByTestId('condition-component-id').selectOption('project-a-button');
    await sheet.getByTestId('condition-source-key').fill('text');
    await sheet.getByTestId('condition-value').fill('查看详情');
    await expect(
      sheet.locator('[data-testid="blueprint-node"][data-node-kind="condition"]'),
    ).toHaveCount(1);

    await insertBlueprintNode(sheet, 'delay', { x: 500, y: 250 });
    await sheet.getByTestId('config-delay-ms').fill('750');
    await expect(
      sheet.locator('[data-testid="blueprint-node"][data-node-kind="delay"]'),
    ).toContainText('750ms');

    await insertBlueprintNode(sheet, 'comment', { x: 760, y: 180 });
    await sheet.getByTestId('config-comment-text').fill('发布前人工确认');
    await expect(
      sheet.locator('[data-testid="blueprint-node"][data-node-kind="comment"]'),
    ).toContainText('发布前人工确认');

    await sheet.getByTestId('blueprint-canvas').dblclick({ position: { x: 620, y: 420 } });
    const searchPanel = sheet.getByTestId('blueprint-search-panel');
    await searchPanel.getByLabel('搜索节点').fill('请求接口');
    await expect(searchPanel.getByText('无匹配节点')).toBeVisible();
    await expect(searchPanel.getByTestId('blueprint-search-panel-item')).toHaveCount(0);
    await searchPanel.getByLabel('搜索节点').fill('导航跳转');
    await expect(searchPanel.locator('[data-option-id="global.navigate"]')).toBeVisible();
    await searchPanel.getByTestId('blueprint-search-panel-close').click();

    await insertBlueprintNode(sheet, 'component.project-a-bar-chart', { x: 300, y: 500 });
    const chartNode = sheet
      .locator('[data-testid="blueprint-node"][data-node-kind="component"]')
      .filter({ hasText: '季度销售额' });
    await expect(chartNode.locator('[data-anchor-side="target"]')).toHaveCount(3);
    await expect(chartNode.locator('[data-anchor-id="act:show"]')).toHaveCount(1);
    await expect(chartNode.locator('[data-anchor-id="act:hide"]')).toHaveCount(1);
    await expect(chartNode.locator('[data-anchor-id="act:toggleVisibility"]')).toHaveCount(1);
    await expect(chartNode.locator('[data-anchor-side="source"]')).toHaveCount(2);
    await expect(chartNode.locator('[data-anchor-id="act:refreshData"]')).toHaveCount(0);
    await expect(chartNode.locator('[data-anchor-id="evt:dataLoaded"]')).toHaveCount(0);

    const draft = await getDraft(page);
    expect(draft?.document.blueprint?.version).toBe(2);
    expect(draft?.document.blueprint?.nodes.map((node) => node.kind).sort()).toEqual([
      'comment',
      'component',
      'condition',
      'delay',
    ]);
  });
});
