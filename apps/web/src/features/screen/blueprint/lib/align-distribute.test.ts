/**
 * align-distribute 纯函数单元测试（任务 9.4）
 */

import { describe, expect, it } from 'vitest';

import {
  alignNodes,
  applyAlignResultToNodes,
  distributeNodes,
  type AlignNode,
} from './align-distribute';

/** 创建对齐节点测试 fixture */
function makeNode(id: string, x: number, y: number, width = 100, height = 80): AlignNode {
  return { id, position: { x, y }, width, height };
}

describe('alignNodes', () => {
  describe('边界情况', () => {
    it('空数组：返回空 items，hasChange=false', () => {
      const result = alignNodes([], 'left');
      expect(result.items).toEqual([]);
      expect(result.hasChange).toBe(false);
    });

    it('单个节点：原样返回，hasChange=false', () => {
      const node = makeNode('a', 10, 20);
      const result = alignNodes([node], 'left');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe('a');
      expect(result.items[0]?.position).toEqual({ x: 10, y: 20 });
      expect(result.hasChange).toBe(false);
    });

    it('节点已对齐时：hasChange=false', () => {
      // 两个节点左边缘已对齐
      const nodes = [makeNode('a', 0, 0), makeNode('b', 0, 100)];
      const result = alignNodes(nodes, 'left');
      expect(result.hasChange).toBe(false);
      expect(result.items[0]?.position).toEqual({ x: 0, y: 0 });
      expect(result.items[1]?.position).toEqual({ x: 0, y: 100 });
    });

    it('不修改输入数组', () => {
      const nodes = [makeNode('a', 10, 20), makeNode('b', 50, 60)];
      const snapshot = nodes.map((n) => ({ ...n, position: { ...n.position } }));
      alignNodes(nodes, 'left');
      expect(nodes).toEqual(snapshot);
    });

    it('items 顺序与输入一致', () => {
      const nodes = [
        makeNode('first', 30, 30),
        makeNode('second', 10, 10),
        makeNode('third', 50, 50),
      ];
      const result = alignNodes(nodes, 'left');
      expect(result.items.map((i) => i.id)).toEqual(['first', 'second', 'third']);
    });
  });

  describe('水平对齐', () => {
    const nodes = [
      makeNode('a', 0, 0, 100, 80),
      makeNode('b', 100, 50, 200, 60),
      makeNode('c', 50, 100, 50, 40),
    ];

    it('left：所有节点 x 对齐到 minX=0', () => {
      const result = alignNodes(nodes, 'left');
      expect(result.hasChange).toBe(true);
      expect(result.items[0]?.position.x).toBe(0);
      expect(result.items[1]?.position.x).toBe(0);
      expect(result.items[2]?.position.x).toBe(0);
      // y 不变
      expect(result.items[0]?.position.y).toBe(0);
      expect(result.items[1]?.position.y).toBe(50);
      expect(result.items[2]?.position.y).toBe(100);
    });

    it('right：所有节点右边缘对齐到 maxX=300（b.x+width=100+200=300）', () => {
      const result = alignNodes(nodes, 'right');
      expect(result.hasChange).toBe(true);
      expect(result.items[0]?.position.x).toBe(200); // 300 - 100
      expect(result.items[1]?.position.x).toBe(100); // 300 - 200
      expect(result.items[2]?.position.x).toBe(250); // 300 - 50
    });

    it('center-h：所有节点水平中心对齐到 (0+300)/2=150', () => {
      const result = alignNodes(nodes, 'center-h');
      expect(result.hasChange).toBe(true);
      expect(result.items[0]?.position.x).toBe(100); // 150 - 100/2
      expect(result.items[1]?.position.x).toBe(50); // 150 - 200/2
      expect(result.items[2]?.position.x).toBe(125); // 150 - 50/2
    });
  });

  describe('垂直对齐', () => {
    const nodes = [
      makeNode('a', 0, 0, 100, 80),
      makeNode('b', 100, 50, 200, 60),
      makeNode('c', 50, 100, 50, 40),
    ];

    it('top：所有节点 y 对齐到 minY=0', () => {
      const result = alignNodes(nodes, 'top');
      expect(result.hasChange).toBe(true);
      expect(result.items[0]?.position.y).toBe(0);
      expect(result.items[1]?.position.y).toBe(0);
      expect(result.items[2]?.position.y).toBe(0);
      // x 不变
      expect(result.items[0]?.position.x).toBe(0);
      expect(result.items[1]?.position.x).toBe(100);
      expect(result.items[2]?.position.x).toBe(50);
    });

    it('bottom：所有节点底边对齐到 maxY=140（c.y+height=100+40=140）', () => {
      const result = alignNodes(nodes, 'bottom');
      expect(result.hasChange).toBe(true);
      expect(result.items[0]?.position.y).toBe(60); // 140 - 80
      expect(result.items[1]?.position.y).toBe(80); // 140 - 60
      expect(result.items[2]?.position.y).toBe(100); // 140 - 40
    });

    it('middle-v：所有节点垂直中心对齐到 (0+140)/2=70', () => {
      const result = alignNodes(nodes, 'middle-v');
      expect(result.hasChange).toBe(true);
      expect(result.items[0]?.position.y).toBe(30); // 70 - 80/2
      expect(result.items[1]?.position.y).toBe(40); // 70 - 60/2
      expect(result.items[2]?.position.y).toBe(50); // 70 - 40/2
    });
  });

  describe('退化情形', () => {
    it('width=0 / height=0 仍可对齐', () => {
      const nodes = [makeNode('a', 10, 10, 0, 0), makeNode('b', 50, 50, 0, 0)];
      // left: x=10（min），y 不变
      const leftResult = alignNodes(nodes, 'left');
      expect(leftResult.items[0]?.position).toEqual({ x: 10, y: 10 });
      expect(leftResult.items[1]?.position).toEqual({ x: 10, y: 50 });

      // top: y=10（min），x 不变
      const topResult = alignNodes(nodes, 'top');
      expect(topResult.items[0]?.position).toEqual({ x: 10, y: 10 });
      expect(topResult.items[1]?.position).toEqual({ x: 50, y: 10 });

      // center-h: centerX = (10 + 50) / 2 = 30，width=0，新 x = 30
      const centerResult = alignNodes(nodes, 'center-h');
      expect(centerResult.items[0]?.position.x).toBe(30);
      expect(centerResult.items[1]?.position.x).toBe(30);
    });
  });
});

describe('distributeNodes', () => {
  describe('边界情况', () => {
    it('空数组：原样返回', () => {
      const result = distributeNodes([], 'horizontal');
      expect(result.items).toEqual([]);
      expect(result.hasChange).toBe(false);
    });

    it('1 个节点：原样返回', () => {
      const result = distributeNodes([makeNode('a', 0, 0)], 'horizontal');
      expect(result.items).toHaveLength(1);
      expect(result.hasChange).toBe(false);
    });

    it('2 个节点：分布无意义，原样返回', () => {
      const nodes = [makeNode('a', 0, 0), makeNode('b', 100, 0)];
      const result = distributeNodes(nodes, 'horizontal');
      expect(result.hasChange).toBe(false);
      expect(result.items[0]?.position.x).toBe(0);
      expect(result.items[1]?.position.x).toBe(100);
    });

    it('不修改输入数组', () => {
      const nodes = [makeNode('a', 0, 0), makeNode('b', 50, 0), makeNode('c', 200, 0)];
      const snapshot = nodes.map((n) => ({ ...n, position: { ...n.position } }));
      distributeNodes(nodes, 'horizontal');
      expect(nodes).toEqual(snapshot);
    });

    it('items 顺序与输入一致（即使内部按中心排序）', () => {
      // 输入顺序为 c, a, b（非中心升序）
      const nodes = [makeNode('c', 200, 0), makeNode('a', 0, 0), makeNode('b', 50, 0)];
      const result = distributeNodes(nodes, 'horizontal');
      expect(result.items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
    });
  });

  describe('水平分布', () => {
    it('3 个等宽节点等距分布', () => {
      // 三个节点宽 100，中心 X 分别为 50, 100, 250
      // firstCenter = 50, lastCenter = 250, step = (250-50)/2 = 100
      // 期望中心 X: 50, 150, 250
      const nodes = [
        makeNode('a', 0, 0, 100, 80), // center 50
        makeNode('b', 50, 0, 100, 80), // center 100
        makeNode('c', 200, 0, 100, 80), // center 250
      ];
      const result = distributeNodes(nodes, 'horizontal');
      expect(result.hasChange).toBe(true);
      // 中心 X
      expect(result.items[0]?.position.x + 50).toBe(50);
      expect(result.items[1]?.position.x + 50).toBe(150);
      expect(result.items[2]?.position.x + 50).toBe(250);
    });

    it('不同宽度节点等距分布（基于中心）', () => {
      // a: 宽 50，中心 25；b: 宽 100，中心 150；c: 宽 200，中心 400
      // firstCenter = 25, lastCenter = 400, step = (400-25)/2 = 187.5
      // 期望中心: 25, 212.5, 400
      const nodes = [
        makeNode('a', 0, 0, 50, 80),
        makeNode('b', 100, 0, 100, 80),
        makeNode('c', 300, 0, 200, 80),
      ];
      const result = distributeNodes(nodes, 'horizontal');
      expect(result.hasChange).toBe(true);
      expect(result.items[0]?.position.x + 25).toBe(25); // 不变
      expect(result.items[1]?.position.x + 50).toBe(212.5);
      expect(result.items[2]?.position.x + 100).toBe(400); // 不变
      // y 不变
      expect(result.items[0]?.position.y).toBe(0);
      expect(result.items[1]?.position.y).toBe(0);
      expect(result.items[2]?.position.y).toBe(0);
    });

    it('内部顺序按中心 X 升序排序（输入乱序）', () => {
      // 输入顺序 c, a, b；按中心升序应为 a, b, c
      const nodes = [
        makeNode('c', 200, 0, 100, 80), // center 250
        makeNode('a', 0, 0, 100, 80), // center 50
        makeNode('b', 50, 0, 100, 80), // center 100
      ];
      const result = distributeNodes(nodes, 'horizontal');
      // a 应保持 center=50，c 应保持 center=250，b 应在中间 center=150
      const aItem = result.items.find((i) => i.id === 'a');
      const bItem = result.items.find((i) => i.id === 'b');
      const cItem = result.items.find((i) => i.id === 'c');
      expect(aItem).toBeDefined();
      expect(bItem).toBeDefined();
      expect(cItem).toBeDefined();
      expect(aItem!.position.x + 50).toBe(50);
      expect(bItem!.position.x + 50).toBe(150);
      expect(cItem!.position.x + 50).toBe(250);
    });

    it('4 个节点等距分布', () => {
      // 中心 X: 0, 30, 60, 300 → firstCenter=0, lastCenter=300, step=100
      const nodes = [
        makeNode('a', -50, 0, 100, 80), // center 0
        makeNode('b', -20, 0, 100, 80), // center 30
        makeNode('c', 10, 0, 100, 80), // center 60
        makeNode('d', 250, 0, 100, 80), // center 300
      ];
      const result = distributeNodes(nodes, 'horizontal');
      expect(result.hasChange).toBe(true);
      // 中心 X 应为 0, 100, 200, 300
      expect(result.items[0]?.position.x + 50).toBe(0);
      expect(result.items[1]?.position.x + 50).toBe(100);
      expect(result.items[2]?.position.x + 50).toBe(200);
      expect(result.items[3]?.position.x + 50).toBe(300);
    });

    it('firstCenter=lastCenter 时（首尾重合）step=0，所有节点中心对齐', () => {
      // 三个节点中心 X 都是 50，但 y 不同
      const nodes = [
        makeNode('a', 0, 0, 100, 80), // center 50
        makeNode('b', 20, 0, 60, 80), // center 50
        makeNode('c', 50, 0, 0, 80), // center 50
      ];
      const result = distributeNodes(nodes, 'horizontal');
      expect(result.hasChange).toBe(false); // 都已是 center 50，无变化
    });
  });

  describe('垂直分布', () => {
    it('3 个等高节点等距分布', () => {
      // 中心 Y 分别为 40, 90, 240
      // firstCenter = 40, lastCenter = 240, step = (240-40)/2 = 100
      // 期望中心 Y: 40, 140, 240
      const nodes = [
        makeNode('a', 0, 0, 100, 80), // center Y 40
        makeNode('b', 0, 50, 100, 80), // center Y 90
        makeNode('c', 0, 200, 100, 80), // center Y 240
      ];
      const result = distributeNodes(nodes, 'vertical');
      expect(result.hasChange).toBe(true);
      expect(result.items[0]?.position.y + 40).toBe(40);
      expect(result.items[1]?.position.y + 40).toBe(140);
      expect(result.items[2]?.position.y + 40).toBe(240);
      // x 不变
      expect(result.items[0]?.position.x).toBe(0);
      expect(result.items[1]?.position.x).toBe(0);
      expect(result.items[2]?.position.x).toBe(0);
    });
  });
});

describe('applyAlignResultToNodes', () => {
  it('按 id 匹配并更新 position', () => {
    const rfNodes = [
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 100, y: 100 }, data: {} },
      { id: 'c', position: { x: 200, y: 200 }, data: { extra: true } },
    ];
    const items = [
      { id: 'a', position: { x: 10, y: 20 } },
      { id: 'c', position: { x: 210, y: 220 } },
    ];
    const result = applyAlignResultToNodes(rfNodes, items);
    expect(result[0]?.position).toEqual({ x: 10, y: 20 });
    // b 未匹配，保持原样
    expect(result[1]?.position).toEqual({ x: 100, y: 100 });
    // c 匹配且保留其他字段（如 data）
    expect(result[2]?.position).toEqual({ x: 210, y: 220 });
    expect(result[2]?.data).toEqual({ extra: true });
  });

  it('不修改原数组', () => {
    const rfNodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 100, y: 100 } },
    ];
    const snapshot = rfNodes.map((n) => ({ ...n, position: { ...n.position } }));
    applyAlignResultToNodes(rfNodes, [{ id: 'a', position: { x: 50, y: 50 } }]);
    expect(rfNodes).toEqual(snapshot);
  });

  it('items 为空时返回浅拷贝', () => {
    const rfNodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 100, y: 100 } },
    ];
    const result = applyAlignResultToNodes(rfNodes, []);
    expect(result).toEqual(rfNodes);
    // 应是新数组（浅拷贝）
    expect(result).not.toBe(rfNodes);
  });

  it('保留原始节点的非 id/position 字段', () => {
    interface RFNodeWithExtra {
      id: string;
      position: { x: number; y: number };
      type: string;
      selected: boolean;
    }
    const rfNodes: RFNodeWithExtra[] = [
      { id: 'a', position: { x: 0, y: 0 }, type: 'trigger', selected: true },
      { id: 'b', position: { x: 100, y: 100 }, type: 'action', selected: false },
    ];
    const result = applyAlignResultToNodes(rfNodes, [{ id: 'a', position: { x: 50, y: 50 } }]);
    expect(result[0]).toEqual({
      id: 'a',
      position: { x: 50, y: 50 },
      type: 'trigger',
      selected: true,
    });
    // b 不变
    expect(result[1]).toEqual({
      id: 'b',
      position: { x: 100, y: 100 },
      type: 'action',
      selected: false,
    });
  });
});
