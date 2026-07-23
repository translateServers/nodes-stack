/**
 * buildValidatedTemplate 测试（任务 9.3）
 *
 * 验证点：
 * - 三个模板都通过 Schema 校验，返回 success
 * - success 结果包含正确的 blueprint
 * - 结果类型判别（success=true/false 互斥）
 * - 失败路径：未知 templateId 返回 failure（不抛异常）
 *
 * 不在此处测试与 editor-store 的集成（由 template-insertion.integration.test.ts 覆盖）。
 */

import { describe, expect, it } from 'vitest';
import { buildValidatedTemplate } from './build-validated-template';
import { createTemplateBlueprint } from './create-template-blueprint';
import type { BlueprintTemplateId } from './template-definitions';
import type { EventBlueprint } from '@nebula/shared';

describe('buildValidatedTemplate（任务 9.3）', () => {
  describe('三个模板均通过 Schema 校验', () => {
    it('click-navigate 通过校验', () => {
      const result = buildValidatedTemplate('click-navigate');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.blueprint.version).toBe(1);
        expect(result.blueprint.nodes).toHaveLength(2);
        expect(result.blueprint.edges).toHaveLength(1);
      }
    });

    it('click-toggle-visibility 通过校验', () => {
      const result = buildValidatedTemplate('click-toggle-visibility');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.blueprint.nodes).toHaveLength(2);
        expect(result.blueprint.edges).toHaveLength(1);
      }
    });

    it('page-load-refresh 通过校验', () => {
      const result = buildValidatedTemplate('page-load-refresh');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.blueprint.nodes).toHaveLength(2);
        expect(result.blueprint.edges).toHaveLength(1);
      }
    });
  });

  describe('success 结果与 createTemplateBlueprint 内容一致', () => {
    it('success 结果的 blueprint 与 createTemplateBlueprint 返回值结构相同', () => {
      const ids: BlueprintTemplateId[] = [
        'click-navigate',
        'click-toggle-visibility',
        'page-load-refresh',
      ];

      for (const id of ids) {
        const result = buildValidatedTemplate(id);
        const direct = createTemplateBlueprint(id);
        expect(result.success).toBe(true);
        if (result.success) {
          // 经 Schema 校验后内容应与直接构造一致
          expect(result.blueprint).toEqual(direct);
        }
      }
    });
  });

  describe('失败路径', () => {
    it('未知 templateId 返回 failure，不抛异常', () => {
      // 模拟未知 templateId：通过断言为 BlueprintTemplateId 绕过编译期检查
      // 实际运行时 createTemplateBlueprint 会抛 Error，buildValidatedTemplate 应捕获
      const unknownId = 'unknown-template' as unknown as BlueprintTemplateId;

      // 不应抛异常
      const result = buildValidatedTemplate(unknownId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('构造模板失败');
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Result 类型判别', () => {
    it('success=true 时 blueprint 字段存在', () => {
      const result = buildValidatedTemplate('click-navigate');

      if (result.success) {
        // TypeScript 在 if 块内收窄为 TemplateBuildSuccess
        const bp: EventBlueprint = result.blueprint;
        expect(bp).toBeDefined();
      } else {
        // 不应进入此分支
        expect.unreachable('Should be success');
      }
    });

    it('success=false 时 error 字段存在', () => {
      const unknownId = 'unknown' as unknown as BlueprintTemplateId;
      const result = buildValidatedTemplate(unknownId);

      if (!result.success) {
        // TypeScript 在 if 块内收窄为 TemplateBuildFailure
        const err: string = result.error;
        expect(err).toBeDefined();
        expect(typeof err).toBe('string');
      } else {
        expect.unreachable('Should be failure');
      }
    });
  });
});
