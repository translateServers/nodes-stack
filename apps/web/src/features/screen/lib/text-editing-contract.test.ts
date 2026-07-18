import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEXT_CONTENT,
  isTextEmpty,
  hasTextChanges,
  resolveTextCommit,
  type TextEditSession,
} from './text-editing-contract';

/**
 * 任务 5.1 验证：文本创建与编辑会话契约
 *
 * 覆盖两条路径：
 * 1. 创建新文本：isNewlyCreated=true
 * 2. 编辑已有文本：isNewlyCreated=false
 *
 * 覆盖提交/取消/失焦/空内容/无变化 等场景
 */

describe('任务 5.1：文本创建与编辑会话契约', () => {
  describe('默认文本内容', () => {
    it('DEFAULT_TEXT_CONTENT 为非空字符串', () => {
      expect(DEFAULT_TEXT_CONTENT).toBe('请输入文本');
      expect(isTextEmpty(DEFAULT_TEXT_CONTENT)).toBe(false);
    });
  });

  describe('isTextEmpty', () => {
    it('空字符串为空', () => {
      expect(isTextEmpty('')).toBe(true);
    });
    it('仅空白字符为空', () => {
      expect(isTextEmpty('   ')).toBe(true);
      expect(isTextEmpty('\t\n')).toBe(true);
    });
    it('非空内容不为空', () => {
      expect(isTextEmpty('hello')).toBe(false);
      expect(isTextEmpty(' a ')).toBe(false);
    });
  });

  describe('hasTextChanges', () => {
    it('内容相同返回 false', () => {
      expect(hasTextChanges('abc', 'abc')).toBe(false);
    });
    it('内容不同返回 true', () => {
      expect(hasTextChanges('abc', 'abd')).toBe(true);
      expect(hasTextChanges('', 'a')).toBe(true);
    });
  });

  describe('resolveTextCommit — 取消路径', () => {
    it('cancel 恢复初始内容，不写入历史，不删除组件', () => {
      const result = resolveTextCommit('原始', '修改后', 'cancel', false);
      expect(result.exitKind).toBe('cancel');
      expect(result.content).toBe('原始');
      expect(result.shouldCommitHistory).toBe(false);
      expect(result.shouldDeleteComponent).toBe(false);
    });

    it('cancel 即使新建组件也不删除（用户显式取消）', () => {
      const result = resolveTextCommit(DEFAULT_TEXT_CONTENT, '新内容', 'cancel', true);
      expect(result.shouldDeleteComponent).toBe(false);
      expect(result.shouldCommitHistory).toBe(false);
    });
  });

  describe('resolveTextCommit — 编辑已有文本（isNewlyCreated=false）', () => {
    it('有变化提交写入历史', () => {
      const result = resolveTextCommit('旧', '新', 'commit', false);
      expect(result.exitKind).toBe('commit');
      expect(result.content).toBe('新');
      expect(result.shouldCommitHistory).toBe(true);
      expect(result.shouldDeleteComponent).toBe(false);
    });

    it('无变化提交不写入历史', () => {
      const result = resolveTextCommit('相同', '相同', 'commit', false);
      expect(result.shouldCommitHistory).toBe(false);
      expect(result.shouldDeleteComponent).toBe(false);
    });

    it('清空已有文本提交写入历史（允许清空）', () => {
      const result = resolveTextCommit('有内容', '', 'commit', false);
      expect(result.exitKind).toBe('commit');
      expect(result.shouldCommitHistory).toBe(true);
      expect(result.shouldDeleteComponent).toBe(false);
    });

    it('仅空白内容也视为有变化写入历史', () => {
      const result = resolveTextCommit('有内容', '   ', 'commit', false);
      expect(result.shouldCommitHistory).toBe(true);
      expect(result.shouldDeleteComponent).toBe(false);
    });
  });

  describe('resolveTextCommit — 创建新文本（isNewlyCreated=true）', () => {
    it('输入有效内容提交写入历史', () => {
      const result = resolveTextCommit(DEFAULT_TEXT_CONTENT, '用户输入', 'commit', true);
      expect(result.exitKind).toBe('commit');
      expect(result.content).toBe('用户输入');
      expect(result.shouldCommitHistory).toBe(true);
      expect(result.shouldDeleteComponent).toBe(false);
    });

    it('未修改默认内容提交不写入历史', () => {
      const result = resolveTextCommit(DEFAULT_TEXT_CONTENT, DEFAULT_TEXT_CONTENT, 'commit', true);
      expect(result.shouldCommitHistory).toBe(false);
      expect(result.shouldDeleteComponent).toBe(false);
    });

    it('空内容提交删除组件（取消创建）', () => {
      const result = resolveTextCommit(DEFAULT_TEXT_CONTENT, '', 'commit', true);
      expect(result.exitKind).toBe('commit-empty');
      expect(result.shouldCommitHistory).toBe(false);
      expect(result.shouldDeleteComponent).toBe(true);
    });

    it('仅空白内容提交删除组件', () => {
      const result = resolveTextCommit(DEFAULT_TEXT_CONTENT, '  \n ', 'commit', true);
      expect(result.exitKind).toBe('commit-empty');
      expect(result.shouldDeleteComponent).toBe(true);
    });
  });

  describe('TextEditSession 上下文', () => {
    it('创建路径：isNewlyCreated=true', () => {
      const session: TextEditSession = {
        componentId: 'new-1',
        initialContent: DEFAULT_TEXT_CONTENT,
        isNewlyCreated: true,
      };
      expect(session.isNewlyCreated).toBe(true);
    });

    it('编辑路径：isNewlyCreated=false', () => {
      const session: TextEditSession = {
        componentId: 'existing-1',
        initialContent: '已有内容',
        isNewlyCreated: false,
      };
      expect(session.isNewlyCreated).toBe(false);
    });
  });
});
