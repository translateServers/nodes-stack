/**
 * 模板蓝图构造纯函数。
 *
 * 根据 templateId 构造完整的 EventBlueprint（含组件节点 / 全局节点 / 逻辑节点 + 边）。
 *
 * 设计约定：
 * - 节点 ID 使用语义化固定值（'comp-a' / 'comp-b' / 'global-pageLoad' / 'delay-1' 等），
 *   便于测试断言；与运行时随机 ID 区分（运行时使用 timestamp+random），模板插入后用户可继续编辑。
 * - componentId / targetComponentId 等使用空字符串占位，用户通过属性面板填充；
 *   与 Schema 中"空字符串视为未配置，由编译器诊断"对齐。
 * - 节点位置使用预设布局（左→右水平流水线，间距 240px），用户后续可拖拽调整。
 * - 边使用语义化 handle 格式：evt:{eventId} → act:{actionId} / in → out / then / else。
 *
 * 不做 Schema 校验（由 build-validated-template.ts 负责），仅负责结构构造。
 */

import { EVENT_BLUEPRINT_VERSION, GLOBAL_COMPONENT_ID, type EventBlueprint } from '@nebula/shared';
import type { BlueprintTemplateId } from './template-definitions';

/** 节点位置常量（水平流水线，左→右） */
const POSITION_A = { x: 0, y: 0 } as const;
const POSITION_B = { x: 240, y: 0 } as const;
const POSITION_C = { x: 480, y: 0 } as const;

/** 固定节点 ID（语义化，便于测试断言） */
const COMPONENT_A_ID = 'comp-a';
const COMPONENT_B_ID = 'comp-b';
const GLOBAL_PAGELOAD_ID = 'global-pageLoad';
const GLOBAL_NAVIGATE_ID = 'global-navigate';
const DELAY_NODE_ID = 'delay-1';

/** 固定边 ID 前缀 */
const EDGE_ID = 'edge-1';

/**
 * 构造点击跳转模板蓝图（组件 A 的 evt:click → 全局 navigate 节点的 act:navigate）。
 *
 * - 组件节点 A：componentId 为空（用户后续选择触发组件），锚点从注册表派生
 * - 全局 navigate 节点：固定锚点 act:navigate，url 为空（用户后续填入 URL），target 默认 _blank
 */
function createClickNavigateTemplate(): EventBlueprint {
  return {
    version: EVENT_BLUEPRINT_VERSION,
    nodes: [
      {
        id: COMPONENT_A_ID,
        kind: 'component',
        componentId: '',
        position: { ...POSITION_A },
      },
      {
        id: GLOBAL_NAVIGATE_ID,
        kind: 'component',
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'navigate',
        config: {
          globalType: 'navigate',
          url: '',
          target: '_blank',
        },
        position: { ...POSITION_B },
      },
    ],
    edges: [
      {
        id: EDGE_ID,
        source: COMPONENT_A_ID,
        sourceHandle: 'evt:click',
        target: GLOBAL_NAVIGATE_ID,
        targetHandle: 'act:navigate',
      },
    ],
  };
}

/**
 * 构造显隐切换模板蓝图（组件 A 的 evt:click → 组件 B 的 act:toggleVisibility）。
 *
 * - 组件节点 A：componentId 为空（用户后续选择触发组件）
 * - 组件节点 B：componentId 为空（用户后续选择目标组件），锚点从注册表派生
 */
function createClickToggleVisibilityTemplate(): EventBlueprint {
  return {
    version: EVENT_BLUEPRINT_VERSION,
    nodes: [
      {
        id: COMPONENT_A_ID,
        kind: 'component',
        componentId: '',
        position: { ...POSITION_A },
      },
      {
        id: COMPONENT_B_ID,
        kind: 'component',
        componentId: '',
        position: { ...POSITION_B },
      },
    ],
    edges: [
      {
        id: EDGE_ID,
        source: COMPONENT_A_ID,
        sourceHandle: 'evt:click',
        target: COMPONENT_B_ID,
        targetHandle: 'act:toggleVisibility',
      },
    ],
  };
}

/**
 * 构造页面加载刷新模板蓝图（全局 pageLoad 节点的 evt:pageLoad → 组件 B 的 act:refreshData）。
 *
 * - 全局 pageLoad 节点：固定锚点 evt:pageLoad，无 config
 * - 组件节点 B：componentId 为空（用户后续选择数据源组件），锚点从注册表派生
 */
function createPageLoadRefreshTemplate(): EventBlueprint {
  return {
    version: EVENT_BLUEPRINT_VERSION,
    nodes: [
      {
        id: GLOBAL_PAGELOAD_ID,
        kind: 'component',
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'pageLoad',
        position: { ...POSITION_A },
      },
      {
        id: COMPONENT_B_ID,
        kind: 'component',
        componentId: '',
        position: { ...POSITION_B },
      },
    ],
    edges: [
      {
        id: EDGE_ID,
        source: GLOBAL_PAGELOAD_ID,
        sourceHandle: 'evt:pageLoad',
        target: COMPONENT_B_ID,
        targetHandle: 'act:refreshData',
      },
    ],
  };
}

/**
 * 构造延时执行模板蓝图（组件 A 的 evt:click → delay 节点 → 组件 B 的 act:show）。
 *
 * - 组件节点 A：componentId 为空（用户后续选择触发组件）
 * - delay 节点：delayMs 默认 500ms（用户可在配置面板调整，范围 0~60000）
 * - 组件节点 B：componentId 为空（用户后续选择目标组件），锚点从注册表派生
 *
 * 三节点流水线：A → delay → B，演示延时逻辑节点的用法。
 */
function createClickDelayShowTemplate(): EventBlueprint {
  return {
    version: EVENT_BLUEPRINT_VERSION,
    nodes: [
      {
        id: COMPONENT_A_ID,
        kind: 'component',
        componentId: '',
        position: { ...POSITION_A },
      },
      {
        id: DELAY_NODE_ID,
        kind: 'delay',
        config: { delayMs: 500 },
        position: { ...POSITION_B },
      },
      {
        id: COMPONENT_B_ID,
        kind: 'component',
        componentId: '',
        position: { ...POSITION_C },
      },
    ],
    edges: [
      {
        id: EDGE_ID,
        source: COMPONENT_A_ID,
        sourceHandle: 'evt:click',
        target: DELAY_NODE_ID,
        targetHandle: 'in',
      },
      {
        id: 'edge-2',
        source: DELAY_NODE_ID,
        sourceHandle: 'out',
        target: COMPONENT_B_ID,
        targetHandle: 'act:show',
      },
    ],
  };
}

/**
 * 根据 templateId 构造模板蓝图。
 *
 * @param templateId  模板标识
 * @returns 完整的 EventBlueprint（含组件节点 / 全局节点 / 逻辑节点 + 边）
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
    case 'click-delay-show':
      return createClickDelayShowTemplate();
    default: {
      // exhaustive check：未知 templateId 视为编程错误
      const exhaustive: never = templateId;
      throw new Error(`Unknown template id: ${String(exhaustive)}`);
    }
  }
}
