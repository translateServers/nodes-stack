import { describe, expect, it } from 'vitest';
import { COMPONENT_DEFINITIONS, searchComponentDefinitions } from '../registry';

/**
 * searchComponentDefinitions 相关度排序测试（Spec Task 8）
 *
 * 评分规则：
 * - 4：name 完全匹配
 * - 3：name 前缀匹配
 * - 2：name 包含匹配
 * - 1：type 包含 或 keywords 包含
 *
 * 同分按 order 升序（order 缺省视为 0），同 order 保持注册顺序（稳定排序）。
 *
 * 现有 6 个组件（注册顺序 → type / name / order / keywords）：
 * - text      / 文本   / order=1 / 文本,文字,text,title,标题,段落
 * - bar-chart / 柱状图 / order=1 / 柱状图,图表,chart,bar,数据图,可视化,统计图
 * - rect      / 矩形   / order=1 / 矩形,方形,rect,rectangle,框,色块
 * - ellipse   / 椭圆   / order=2 / 椭圆,圆形,圆,ellipse,circle,球
 * - image     / 图片   / order=1 / 图片,图像,image,img,照片,picture,logo
 * - button    / 按钮   / order=2 / 按钮,button,btn,点击,交互,提交,确认
 */
describe('registry · searchComponentDefinitions 相关度排序', () => {
  describe('空关键词', () => {
    it('空字符串返回全部定义', () => {
      expect(searchComponentDefinitions('')).toHaveLength(COMPONENT_DEFINITIONS.length);
    });

    it('纯空白字符返回全部定义', () => {
      expect(searchComponentDefinitions('   ')).toHaveLength(COMPONENT_DEFINITIONS.length);
    });

    it('空关键词保持注册顺序', () => {
      const result = searchComponentDefinitions('');
      // 注册顺序：text, bar-chart, rect, ellipse, image, button
      expect(result.map((d) => d.type)).toEqual([
        'text',
        'bar-chart',
        'rect',
        'ellipse',
        'image',
        'button',
      ]);
    });
  });

  describe('名称完全匹配（score=4）', () => {
    it('搜「文本」只匹配 text', () => {
      const result = searchComponentDefinitions('文本');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('text');
    });

    it('搜「按钮」只匹配 button', () => {
      const result = searchComponentDefinitions('按钮');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('button');
    });
  });

  describe('名称前缀匹配（score=3）优先于名称包含匹配（score=2）', () => {
    it('搜「图」：图片(前缀) 排在 柱状图(包含) 之前', () => {
      const result = searchComponentDefinitions('图');
      // 图片 name 前缀匹配 score=3，柱状图 name 包含匹配 score=2
      expect(result.map((d) => d.type)).toEqual(['image', 'bar-chart']);
    });
  });

  describe('名称包含匹配（score=2）', () => {
    it('搜「状」匹配 柱状图', () => {
      const result = searchComponentDefinitions('状');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('bar-chart');
    });
  });

  describe('type 包含匹配（score=1）', () => {
    it('搜「rect」匹配 rect（type 包含）', () => {
      const result = searchComponentDefinitions('rect');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('rect');
    });

    it('搜「bar」匹配 bar-chart（type 包含）', () => {
      const result = searchComponentDefinitions('bar');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('bar-chart');
    });
  });

  describe('keywords 别名匹配（score=1）', () => {
    it('搜「rectangle」通过 keywords 命中 rect', () => {
      const result = searchComponentDefinitions('rectangle');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('rect');
    });

    it('搜「circle」通过 keywords 命中 ellipse', () => {
      const result = searchComponentDefinitions('circle');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('ellipse');
    });

    it('搜「logo」通过 keywords 命中 image', () => {
      const result = searchComponentDefinitions('logo');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('image');
    });
  });

  describe('相关度排序：高分优先', () => {
    it('前缀匹配(score=3) 排在 keywords 匹配(score=1) 之前', () => {
      // 搜「图」：图片 name 前缀 score=3；其他组件 keywords 无「图」相关
      // 柱状图 name 包含「图」 score=2
      const result = searchComponentDefinitions('图');
      expect(result[0]?.type).toBe('image');
      expect(result[1]?.type).toBe('bar-chart');
    });
  });

  describe('同分按 order 升序，同 order 保持注册顺序', () => {
    it('搜「t」：所有命中组件 score=1，按 order 升序，同 order 保持注册顺序', () => {
      // type 包含 "t"：text(order=1), bar-chart(order=1), rect(order=1), button(order=2)
      // keywords 包含 "t"：image 的 keywords 含 "picture"（含 t），order=1
      // ellipse 不含 t
      // 同 order=1 按注册顺序：text, bar-chart, rect, image；button(order=2) 在最后
      const result = searchComponentDefinitions('t');
      expect(result.map((d) => d.type)).toEqual(['text', 'bar-chart', 'rect', 'image', 'button']);
    });

    it('同 order 内保持注册顺序（bar-chart 注册早于 rect 早于 image）', () => {
      // 搜「t」结果中 order=1 的组件应按注册顺序：text, bar-chart, rect, image
      const result = searchComponentDefinitions('t');
      const order1 = result.filter((d) => (d.order ?? 0) === 1);
      expect(order1.map((d) => d.type)).toEqual(['text', 'bar-chart', 'rect', 'image']);
    });

    it('order=2 排在 order=1 之后', () => {
      // 搜「t」：button(order=2) 应排在所有 order=1 的组件之后
      const result = searchComponentDefinitions('t');
      const buttonIndex = result.findIndex((d) => d.type === 'button');
      const lastOrder1Index = Math.max(
        ...result.map((d, i) => ((d.order ?? 0) === 1 ? i : -1)).filter((i) => i >= 0),
      );
      expect(buttonIndex).toBeGreaterThan(lastOrder1Index);
    });
  });

  describe('无匹配', () => {
    it('未命中关键词返回空数组', () => {
      expect(searchComponentDefinitions('不存在的组件xxx')).toHaveLength(0);
    });
  });

  describe('大小写不敏感', () => {
    it('大写「RECT」匹配 rect', () => {
      const result = searchComponentDefinitions('RECT');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('rect');
    });

    it('混合大小写「BaR」匹配 bar-chart', () => {
      const result = searchComponentDefinitions('BaR');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('bar-chart');
    });
  });

  describe('前后空白字符被 trim', () => {
    it('「  rect  」等价于「rect」', () => {
      const result = searchComponentDefinitions('  rect  ');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('rect');
    });
  });
});
