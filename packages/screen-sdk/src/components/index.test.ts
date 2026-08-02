import { describe, expect, it } from 'vitest';
import { BUILTIN_SCREEN_COMPONENT_TYPES, createScreenComponentRegistry } from './index.js';

describe('@nebula/screen-sdk/components', () => {
  it('公开内置组件列表并将白名单传递给 registry factory', async () => {
    expect(Object.isFrozen(BUILTIN_SCREEN_COMPONENT_TYPES)).toBe(true);
    expect(BUILTIN_SCREEN_COMPONENT_TYPES).toEqual([
      'text',
      'bar-chart',
      'rect',
      'ellipse',
      'image',
      'button',
    ]);

    const registry = await createScreenComponentRegistry({
      builtInComponents: ['image', 'text'],
    });

    expect(registry.list().map((registration) => registration.manifest.type)).toEqual([
      'text',
      'image',
    ]);
  });

  it('空内置组件白名单返回空 registry', async () => {
    const registry = await createScreenComponentRegistry({ builtInComponents: [] });

    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
  });
});
