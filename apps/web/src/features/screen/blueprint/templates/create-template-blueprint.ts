/**
 * 模板蓝图构造纯函数（任务 9.3）
 *
 * 根据 templateId 构造完整的 EventBlueprint（含 trigger + action + 边）。
 *
 * 设计约定：
 * - 节点 ID 使用语义化固定值（'trigger-1' / 'action-1'），便于测试断言；
 *   与运行时随机 ID 区分（运行时使用 timestamp+random），模板插入后用户可继续编辑。
 * - config 中可空字段（componentId/url/targetComponentId）使用空字符串占位，
 *   用户通过属性面板填充；与 Schema 中"空字符串视为未配置，由编译器诊断"对齐。
 * - 节点位置使用预设布局（trigger 在左，action 在右，水平间距 200px），
 *   用户后续可拖拽调整。
 * - 边连接 trigger.out → action.in，与节点引脚约定一致。
 *
 * 不做 Schema 校验（由 build-validated-template.ts 负责），仅负责结构构造。
 */

import type { EventBlueprint } from '@nebula/shared';
import type { BlueprintTemplateId } from './template-definitions';

/** 节点位置常量（trigger 在 (0,0)，action 在 (200,0)） */
const TRIGGER_POSITION = { x: 0, y: 0 } as const;
const ACTION_POSITION = { x: 200, y: 0 } as const;

/** 固定节点 ID（语义化，便于测试断言） */
const TRIGGER_NODE_ID = 'trigger-1';
const ACTION_NODE_ID = 'action-1';

/** 固定边 ID */
const EDGE_ID = 'edge-1';

/**
 * 构造点击跳转模板蓝图（componentClick → navigate）。
 * - trigger：componentClick，componentId 为空（用户后续选择触发组件）
 * - action：navigate，url 为空（用户后续填入 URL），target 默认 _blank
 */
function createClickNavigateTemplate(): EventBlueprint {
  return {
    version: 1,
    nodes: [
      {
        id: TRIGGER_NODE_ID,
        kind: 'trigger',
        position: { ...TRIGGER_POSITION },
        config: { type: 'componentClick', componentId: '' },
      },
      {
        id: ACTION_NODE_ID,
        kind: 'action',
        position: { ...ACTION_POSITION },
        config: { type: 'navigate', url: '', target: '_blank' },
      },
    ],
    edges: [
      {
        id: EDGE_ID,
        source: TRIGGER_NODE_ID,
        sourceHandle: 'out',
        target: ACTION_NODE_ID,
        targetHandle: 'in',
      },
    ],
  };
}

/**
 * 构造显隐切换模板蓝图（componentClick → setVisibility toggle）。
 * - trigger：componentClick，componentId 为空
 * - action：setVisibility，targetComponentId 为空，visible 为 toggle（切换）
 */
function createClickToggleVisibilityTemplate(): EventBlueprint {
  return {
    version: 1,
    nodes: [
      {
        id: TRIGGER_NODE_ID,
        kind: 'trigger',
        position: { ...TRIGGER_POSITION },
        config: { type: 'componentClick', componentId: '' },
      },
      {
        id: ACTION_NODE_ID,
        kind: 'action',
        position: { ...ACTION_POSITION },
        config: {
          type: 'setVisibility',
          targetComponentId: '',
          visible: 'toggle',
        },
      },
    ],
    edges: [
      {
        id: EDGE_ID,
        source: TRIGGER_NODE_ID,
        sourceHandle: 'out',
        target: ACTION_NODE_ID,
        targetHandle: 'in',
      },
    ],
  };
}

/**
 * 构造页面加载刷新模板蓝图（pageLoad → refreshDataSource）。
 * - trigger：pageLoad（无关联组件）
 * - action：refreshDataSource，targetComponentId 为空
 */
function createPageLoadRefreshTemplate(): EventBlueprint {
  return {
    version: 1,
    nodes: [
      {
        id: TRIGGER_NODE_ID,
        kind: 'trigger',
        position: { ...TRIGGER_POSITION },
        config: { type: 'pageLoad' },
      },
      {
        id: ACTION_NODE_ID,
        kind: 'action',
        position: { ...ACTION_POSITION },
        config: {
          type: 'refreshDataSource',
          targetComponentId: '',
        },
      },
    ],
    edges: [
      {
        id: EDGE_ID,
        source: TRIGGER_NODE_ID,
        sourceHandle: 'out',
        target: ACTION_NODE_ID,
        targetHandle: 'in',
      },
    ],
  };
}

/**
 * 根据 templateId 构造模板蓝图。
 *
 * @param templateId  模板标识
 * @returns 完整的 EventBlueprint（含 trigger + action + 边）
 * @throws 当 templateId 不在已知模板列表时抛出 Error（不应在运行时发生，
 *         调用方应通过 build-validated-template 包装捕获）
 */
export function createTemplateBlueprint(templateId: BlueprintTemplateId): EventBlueprint {
  switch (templateId) {
    case 'click-navigate':
      return createClickNavigateTemplate();
    case 'click-toggle-visibility':
      return createClickToggleVisibilityTemplate();
    case 'page-load-refresh':
      return createPageLoadRefreshTemplate();
    default: {
      // exhaustive check：未知 templateId 视为编程错误
      const exhaustive: never = templateId;
      throw new Error(`Unknown template id: ${String(exhaustive)}`);
    }
  }
}
