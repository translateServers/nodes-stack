/**
 * Blueprint compiler tests
 *
 * 测试用例：
 * 1. 空蓝图编译 → 0 rules, 0 diagnostics
 * 2. 简单 evt:click → act:show → 1 rule, 1 action step (show)
 * 3. evt:click → condition.in, condition.then → act:show → 1 rule, 1 condition step with thenSteps
 * 4. evt:click → delay.in, delay.out → act:show → 1 rule, 1 delay step + 1 action step
 * 5. 全局 pageLoad evt:pageLoad → act:show → 1 rule
 * 6. dangling 组件引用 → diagnostic
 * 7. 空全局配置 → diagnostic
 * 8. delay 超范围 → diagnostic
 * 9. 重复节点 ID → diagnostic
 * 10. 深度截断
 */

import { describe, it, expect } from 'vitest';
import type {
  BlueprintEdge,
  BlueprintNode,
  EventBlueprint,
  GlobalNavigateConfig,
} from '@nebula/shared';
import { compileBlueprint } from './compile.js';
import type { CompileContext } from './types.js';

// ===== 公共构造器 =====

function makeComponentNode(id: string, componentId: string): BlueprintNode {
  return {
    id,
    kind: 'component',
    position: { x: 0, y: 0 },
    componentId,
  };
}

function makeGlobalPageLoadNode(id: string): BlueprintNode {
  return {
    id,
    kind: 'component',
    position: { x: 0, y: 0 },
    componentId: 'global',
    globalType: 'pageLoad',
  };
}

function makeGlobalNavigateNode(id: string, url: string): BlueprintNode {
  const config: GlobalNavigateConfig = {
    globalType: 'navigate',
    url,
    target: '_blank',
  };
  return {
    id,
    kind: 'component',
    position: { x: 0, y: 0 },
    componentId: 'global',
    globalType: 'navigate',
    config,
  };
}

function makeConditionNode(id: string): BlueprintNode {
  return {
    id,
    kind: 'condition',
    position: { x: 0, y: 0 },
    config: {
      type: 'condition',
      expression: {
        source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
        operator: 'eq',
        value: '1',
      },
    },
  };
}

function makeDelayNode(id: string, delayMs: number): BlueprintNode {
  return {
    id,
    kind: 'delay',
    position: { x: 0, y: 0 },
    config: { delayMs },
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
): BlueprintEdge {
  return { id, source, target, sourceHandle, targetHandle };
}

function makeBlueprint(nodes: BlueprintNode[], edges: BlueprintEdge[]): EventBlueprint {
  return { version: 2, nodes, edges };
}

function ctxWithComponents(ids: string[]): CompileContext {
  return { componentIds: new Set(ids) };
}

// ===== 测试用例 =====

describe('compileBlueprint', () => {
  describe('基础编译', () => {
    it('1. 空蓝图编译 → 0 rules, 0 diagnostics', () => {
      const bp = makeBlueprint([], []);
      const result = compileBlueprint(bp, ctxWithComponents([]));
      expect(result.rules).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('2. 简单 evt:click → act:show → 1 rule, 1 action step (show)', () => {
      const bp = makeBlueprint(
        [makeComponentNode('c1', 'comp1'), makeComponentNode('c2', 'comp2')],
        [makeEdge('e1', 'c1', 'c2', 'evt:click', 'act:show')],
      );
      const result = compileBlueprint(bp, ctxWithComponents(['comp1', 'comp2']));

      expect(result.rules).toHaveLength(1);
      const rule = result.rules[0];
      expect(rule.triggerNodeId).toBe('c1');
      expect(rule.triggerEventId).toBe('click');
      expect(rule.triggerComponentId).toBe('comp1');
      expect(rule.steps).toHaveLength(1);
      const step = rule.steps[0];
      expect(step.kind).toBe('action');
      if (step.kind === 'action') {
        expect(step.nodeId).toBe('c2');
        expect(step.componentId).toBe('comp2');
        expect(step.config.actionId).toBe('show');
      }
    });

    it('3. evt:click → condition.in, condition.then → act:show → 1 rule, 1 condition step with thenSteps', () => {
      const bp = makeBlueprint(
        [
          makeComponentNode('c1', 'comp1'),
          makeConditionNode('cd1'),
          makeComponentNode('c2', 'comp2'),
        ],
        [
          makeEdge('e1', 'c1', 'cd1', 'evt:click', 'in'),
          makeEdge('e2', 'cd1', 'c2', 'then', 'act:show'),
        ],
      );
      const result = compileBlueprint(bp, ctxWithComponents(['comp1', 'comp2']));

      expect(result.rules).toHaveLength(1);
      const rule = result.rules[0];
      expect(rule.steps).toHaveLength(1);
      const step = rule.steps[0];
      expect(step.kind).toBe('condition');
      if (step.kind === 'condition') {
        expect(step.nodeId).toBe('cd1');
        expect(step.thenSteps).toHaveLength(1);
        expect(step.thenSteps[0]?.kind).toBe('action');
        expect(step.elseSteps).toHaveLength(0);
      }
    });

    it('4. evt:click → delay.in, delay.out → act:show → 1 rule, 1 delay step + 1 action step', () => {
      const bp = makeBlueprint(
        [
          makeComponentNode('c1', 'comp1'),
          makeDelayNode('d1', 500),
          makeComponentNode('c2', 'comp2'),
        ],
        [
          makeEdge('e1', 'c1', 'd1', 'evt:click', 'in'),
          makeEdge('e2', 'd1', 'c2', 'out', 'act:show'),
        ],
      );
      const result = compileBlueprint(bp, ctxWithComponents(['comp1', 'comp2']));

      expect(result.rules).toHaveLength(1);
      const rule = result.rules[0];
      expect(rule.steps).toHaveLength(2);
      expect(rule.steps[0]?.kind).toBe('delay');
      expect(rule.steps[1]?.kind).toBe('action');
      if (rule.steps[0]?.kind === 'delay') {
        expect(rule.steps[0].delayMs).toBe(500);
      }
      if (rule.steps[1]?.kind === 'action') {
        expect(rule.steps[1].config.actionId).toBe('show');
      }
    });

    it('5. 全局 pageLoad evt:pageLoad → act:show → 1 rule', () => {
      const bp = makeBlueprint(
        [makeGlobalPageLoadNode('g1'), makeComponentNode('c2', 'comp2')],
        [makeEdge('e1', 'g1', 'c2', 'evt:pageLoad', 'act:show')],
      );
      const result = compileBlueprint(bp, ctxWithComponents(['comp2']));

      expect(result.rules).toHaveLength(1);
      const rule = result.rules[0];
      expect(rule.triggerNodeId).toBe('g1');
      expect(rule.triggerEventId).toBe('pageLoad');
      expect(rule.triggerComponentId).toBe('global');
      expect(rule.steps).toHaveLength(1);
      expect(rule.steps[0]?.kind).toBe('action');
    });

    it('5b. Phase 4 Task 4.2: evt:valueClick（manifest 自定义事件）→ act:show → 1 rule', () => {
      // Custom manifest events are compiled as regular event triggers.
      const bp = makeBlueprint(
        [makeComponentNode('c1', 'comp1'), makeComponentNode('c2', 'comp2')],
        [makeEdge('e1', 'c1', 'c2', 'evt:valueClick', 'act:show')],
      );
      const result = compileBlueprint(bp, ctxWithComponents(['comp1', 'comp2']));

      expect(result.rules).toHaveLength(1);
      const rule = result.rules[0];
      expect(rule.triggerNodeId).toBe('c1');
      expect(rule.triggerEventId).toBe('valueClick');
      expect(rule.triggerComponentId).toBe('comp1');
      expect(rule.steps).toHaveLength(1);
      const step = rule.steps[0];
      expect(step.kind).toBe('action');
      if (step.kind === 'action') {
        expect(step.nodeId).toBe('c2');
        expect(step.componentId).toBe('comp2');
        expect(step.config.actionId).toBe('show');
      }
    });
  });

  describe('诊断', () => {
    it('6. dangling 组件引用 → diagnostic', () => {
      const bp = makeBlueprint([makeComponentNode('c1', 'missing')], []);
      const result = compileBlueprint(bp, ctxWithComponents(['comp1', 'comp2']));

      const diag = result.diagnostics.find(
        (d) => d.code === 'dangling-component' && d.nodeId === 'c1',
      );
      expect(diag).toBeDefined();
      expect(diag?.level).toBe('error');
    });

    it('7. 空全局配置 → diagnostic', () => {
      const bp = makeBlueprint([makeGlobalNavigateNode('g1', '')], []);
      const result = compileBlueprint(bp, ctxWithComponents([]));

      const diag = result.diagnostics.find((d) => d.code === 'empty-config' && d.nodeId === 'g1');
      expect(diag).toBeDefined();
      expect(diag?.level).toBe('warning');
    });

    it('8. delay 超范围 → diagnostic', () => {
      const bp = makeBlueprint([makeDelayNode('d1', 70_000)], []);
      const result = compileBlueprint(bp, ctxWithComponents([]));

      const diag = result.diagnostics.find((d) => d.code === 'invalid-delay' && d.nodeId === 'd1');
      expect(diag).toBeDefined();
      expect(diag?.level).toBe('error');
    });

    it('9. 重复节点 ID → diagnostic', () => {
      const bp = makeBlueprint(
        [makeComponentNode('c1', 'comp1'), makeComponentNode('c1', 'comp2')],
        [],
      );
      const result = compileBlueprint(bp, ctxWithComponents(['comp1', 'comp2']));

      const diag = result.diagnostics.find((d) => d.code === 'duplicate-node-id');
      expect(diag).toBeDefined();
      expect(diag?.level).toBe('error');
    });
  });

  describe('深度截断', () => {
    it('10. 深度截断：超过最大编译深度的链路被截断', () => {
      // 构造 105 个 delay 节点的链：c1.evt:click → d1.in, d1.out → d2.in, ..., d105.out → c2.act:show
      const delayCount = 105;
      const nodes: BlueprintNode[] = [
        makeComponentNode('c1', 'comp1'),
        makeComponentNode('c2', 'comp2'),
      ];
      for (let i = 1; i <= delayCount; i++) {
        nodes.push(makeDelayNode(`d${i}`, 100));
      }

      const edges: BlueprintEdge[] = [makeEdge('e0', 'c1', 'd1', 'evt:click', 'in')];
      for (let i = 1; i < delayCount; i++) {
        edges.push(makeEdge(`e${i}`, `d${i}`, `d${i + 1}`, 'out', 'in'));
      }
      edges.push(makeEdge('eLast', `d${delayCount}`, 'c2', 'out', 'act:show'));

      const bp = makeBlueprint(nodes, edges);
      const result = compileBlueprint(bp, ctxWithComponents(['comp1', 'comp2']));

      expect(result.rules).toHaveLength(1);
      const rule = result.rules[0];
      // 深度截断：仅产出 101 个 delay step（depth 0 ~ 100），后续 delay 与 action 被截断
      expect(rule.steps.length).toBeLessThanOrEqual(101);
      expect(rule.steps.length).toBe(101);
      // 所有 step 均为 delay（act:show 被截断）
      expect(rule.steps.every((s) => s.kind === 'delay')).toBe(true);
    });
  });
});
