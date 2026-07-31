import { describe, expect, it } from 'vitest';
import { buildAllNodeOptions } from './v2-node-options';

describe('buildAllNodeOptions capability profile', () => {
  it('保留 dynamic profile 的 requestApi 节点', () => {
    expect(buildAllNodeOptions([], 'dynamic').map(({ id }) => id)).toContain('global.requestApi');
  });

  it('static profile 排除 requestApi 并保留白名单节点', () => {
    const options = buildAllNodeOptions([], 'static');
    const ids = options.map(({ id }) => id);

    expect(ids).not.toContain('global.requestApi');
    expect(ids).toEqual(
      expect.arrayContaining([
        'global.pageLoad',
        'global.interval',
        'global.navigate',
        'global.scrollTo',
        'condition',
        'delay',
        'comment',
      ]),
    );
  });
});
