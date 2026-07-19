import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShortcutsHelpDialog } from './shortcuts-help-dialog';
import {
  SHORTCUTS_REGISTRY,
  getShortcutById,
  formatKeys,
  SHORTCUT_CATEGORY_LABELS,
} from '../hooks/shortcuts-registry';
import { TOOL_REGISTRY } from '../hooks/tool-registry';

/**
 * 任务 1.3 验证：快捷键帮助接入统一工具注册表
 *
 * 测试策略：
 * - 不 mock shortcuts-registry 或 tool-registry，验证帮助面板真实消费注册表
 * - 验证工具快捷键和说明由注册表生成或引用
 * - 验证 Alt 拖拽复制、Space 临时抓手和缩放工具反向操作说明存在且与实际一致
 */

describe('ShortcutsHelpDialog 任务 1.3：接入统一工具注册表', () => {
  beforeEach(() => {
    // 帮助面板用 isMac() 决定 mod 键显示；测试固定为 Windows 环境
    vi.stubGlobal('navigator', {
      ...navigator,
      platform: 'Win32',
    });
  });

  it('open=true 时渲染所有非 hidden 的 SHORTCUTS_REGISTRY 条目', () => {
    render(<ShortcutsHelpDialog open={true} onOpenChange={vi.fn()} />);
    for (const entry of SHORTCUTS_REGISTRY) {
      if (entry.hidden) continue;
      expect(screen.getByText(entry.description)).toBeInTheDocument();
    }
  });

  it('open=false 时不渲染', () => {
    render(<ShortcutsHelpDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('快捷键')).not.toBeInTheDocument();
  });

  it('每个工具快捷键条目都能在帮助面板找到对应描述', () => {
    render(<ShortcutsHelpDialog open={true} onOpenChange={vi.fn()} />);
    for (const tool of TOOL_REGISTRY) {
      if (tool.shortcutId === null) continue;
      const shortcut = getShortcutById(tool.shortcutId);
      expect(shortcut).toBeDefined();
      expect(screen.getByText(shortcut!.description)).toBeInTheDocument();
    }
  });

  it('帮助面板包含 Space 临时抓手说明（与实际行为一致）', () => {
    render(<ShortcutsHelpDialog open={true} onOpenChange={vi.fn()} />);
    const entry = getShortcutById('toolHandTemp');
    expect(entry).toBeDefined();
    expect(screen.getByText(entry!.description)).toBeInTheDocument();
    // 验证键位渲染为 'Space'（CODE_TO_DISPLAY 映射）
    const keys = formatKeys(entry!.keys);
    expect(keys).toContain('Space');
  });

  it('帮助面板包含 Alt 拖拽复制说明（与实际行为一致）', () => {
    render(<ShortcutsHelpDialog open={true} onOpenChange={vi.fn()} />);
    const entry = getShortcutById('altDragCopy');
    expect(entry).toBeDefined();
    expect(screen.getByText(entry!.description)).toBeInTheDocument();
    // 验证键位渲染：Alt + 拖拽
    const keys = formatKeys(entry!.keys);
    expect(keys).toContain('Alt');
    expect(keys).toContain('拖拽');
  });

  it('帮助面板包含缩放工具反向操作说明（Alt+滚轮，与实际行为一致）', () => {
    render(<ShortcutsHelpDialog open={true} onOpenChange={vi.fn()} />);
    const entry = getShortcutById('zoomReverse');
    expect(entry).toBeDefined();
    expect(screen.getByText(entry!.description)).toBeInTheDocument();
    const keys = formatKeys(entry!.keys);
    expect(keys).toContain('Alt');
    expect(keys).toContain('滚轮');
  });

  it('帮助面板按 category 分组展示', () => {
    render(<ShortcutsHelpDialog open={true} onOpenChange={vi.fn()} />);
    // 验证所有非 hidden 条目的 category 都有对应的分组标题
    const usedCategories = new Set(
      SHORTCUTS_REGISTRY.filter((s) => !s.hidden).map((s) => s.category),
    );
    for (const cat of usedCategories) {
      expect(screen.getByText(SHORTCUT_CATEGORY_LABELS[cat])).toBeInTheDocument();
    }
  });

  it('工具分组下包含所有 7 个工具快捷键 + 2 个画笔尺寸 + 3 个鼠标/Space 文档条目', () => {
    render(<ShortcutsHelpDialog open={true} onOpenChange={vi.fn()} />);
    const toolShortcuts = SHORTCUTS_REGISTRY.filter((s) => !s.hidden && s.category === 'tool');
    // 7 个工具切换 + 2 个画笔尺寸 + 3 个文档条目（toolHandTemp/altDragCopy/zoomReverse）= 12
    expect(toolShortcuts).toHaveLength(12);
    for (const entry of toolShortcuts) {
      expect(screen.getByText(entry.description)).toBeInTheDocument();
    }
  });

  it('hidden 条目（noop 拦截）不展示在帮助面板', () => {
    render(<ShortcutsHelpDialog open={true} onOpenChange={vi.fn()} />);
    const hiddenEntries = SHORTCUTS_REGISTRY.filter((s) => s.hidden);
    expect(hiddenEntries.length).toBeGreaterThan(0);
    for (const entry of hiddenEntries) {
      expect(screen.queryByText(entry.description)).not.toBeInTheDocument();
    }
  });
});
