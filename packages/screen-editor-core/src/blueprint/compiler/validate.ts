/**
 * 节点参数诊断（任务 2.4）
 *
 * - 悬空引用（dangling-component）：节点引用的 componentId 在项目组件列表中不存在 → warning
 * - 空参数（empty-param）：动作节点缺少必填参数 → error
 *
 * Schema 允许空字符串以便未完成的图可以保存（非破坏原则），
 * 这里在编译期统一诊断，UI 问题面板与运行时共用同一份诊断结果。
 */

import type { BlueprintNode } from '@nebula/shared';
import type { CompileContext, Diagnostic } from './types.js';

/** 收集单个节点的 dangling / empty-param 诊断 */
export function diagnoseNode(node: BlueprintNode, ctx: CompileContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  switch (node.kind) {
    case 'trigger':
      diagnoseTriggerNode(node, ctx, diagnostics);
      break;
    case 'action':
      diagnoseActionNode(node, ctx, diagnostics);
      break;
    case 'condition':
      // M3 交付，契约预留
      diagnoseConditionNode(node, ctx, diagnostics);
      break;
    case 'comment':
      // 注释节点不参与执行，不诊断参数
      break;
  }

  return diagnostics;
}

function diagnoseTriggerNode(
  node: Extract<BlueprintNode, { kind: 'trigger' }>,
  ctx: CompileContext,
  diagnostics: Diagnostic[],
): void {
  const { config } = node;
  if (config.type === 'componentClick') {
    if (config.componentId === '') {
      diagnostics.push({
        level: 'error',
        code: 'empty-param',
        message: '触发器未选择触发组件',
        nodeId: node.id,
        fieldPath: ['config', 'componentId'],
      });
    } else if (!ctx.componentIds.has(config.componentId)) {
      diagnostics.push({
        level: 'warning',
        code: 'dangling-component',
        message: `触发组件 ${config.componentId} 不存在于项目中（dangling）`,
        nodeId: node.id,
        fieldPath: ['config', 'componentId'],
      });
    }
  }
}

function diagnoseActionNode(
  node: Extract<BlueprintNode, { kind: 'action' }>,
  ctx: CompileContext,
  diagnostics: Diagnostic[],
): void {
  const { config } = node;
  switch (config.type) {
    case 'setVisibility':
      diagnoseComponentId(node.id, config.targetComponentId, '目标组件', ctx, diagnostics);
      // visible 为枚举值，Schema 已强制；不诊断空参数
      break;
    case 'navigate':
      if (config.url === '') {
        diagnostics.push({
          level: 'error',
          code: 'empty-param',
          message: 'navigate 动作未填写 URL',
          nodeId: node.id,
          fieldPath: ['config', 'url'],
        });
      }
      // URL 协议白名单由 Schema 强制，不在此诊断
      break;
    case 'scrollToComponent':
      diagnoseComponentId(node.id, config.targetComponentId, '目标组件', ctx, diagnostics);
      break;
    case 'refreshDataSource':
      diagnoseComponentId(node.id, config.targetComponentId, '目标组件', ctx, diagnostics);
      break;
  }
}

function diagnoseConditionNode(
  node: Extract<BlueprintNode, { kind: 'condition' }>,
  ctx: CompileContext,
  diagnostics: Diagnostic[],
): void {
  // M3 交付：condition 节点配置校验，这里仅做基础 componentId 检查
  const {
    expression: { source },
  } = node.config;
  if (source.kind === 'componentProp' || source.kind === 'componentData') {
    if (source.componentId === '') {
      diagnostics.push({
        level: 'error',
        code: 'empty-param',
        message: 'condition 节点未选择数据来源组件',
        nodeId: node.id,
        fieldPath: ['config', 'expression', 'source', 'componentId'],
      });
    } else if (!ctx.componentIds.has(source.componentId)) {
      diagnostics.push({
        level: 'warning',
        code: 'dangling-component',
        message: `condition 数据来源组件 ${source.componentId} 不存在于项目中（dangling）`,
        nodeId: node.id,
        fieldPath: ['config', 'expression', 'source', 'componentId'],
      });
    }
  }
}

/** 公共：componentId 空参数 + dangling 诊断 */
function diagnoseComponentId(
  nodeId: string,
  componentId: string,
  label: string,
  ctx: CompileContext,
  diagnostics: Diagnostic[],
): void {
  if (componentId === '') {
    diagnostics.push({
      level: 'error',
      code: 'empty-param',
      message: `${label}未选择`,
      nodeId,
      fieldPath: ['config', 'targetComponentId'],
    });
  } else if (!ctx.componentIds.has(componentId)) {
    diagnostics.push({
      level: 'warning',
      code: 'dangling-component',
      message: `${label} ${componentId} 不存在于项目中（dangling）`,
      nodeId,
      fieldPath: ['config', 'targetComponentId'],
    });
  }
}
