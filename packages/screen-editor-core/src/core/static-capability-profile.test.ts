import {
  getScreenSdkSourceHandles,
  getScreenSdkTargetHandles,
  isScreenSdkBlueprintNodeKind,
  isScreenSdkGlobalComponentType,
  SCREEN_SDK_STATIC_CAPABILITY_PROFILE,
} from './static-capability-profile.js';

describe('static capability profile', () => {
  it('contains exactly the six V1 component types and no network capability', () => {
    expect(SCREEN_SDK_STATIC_CAPABILITY_PROFILE.componentTypes).toEqual([
      'text',
      'bar-chart',
      'rect',
      'ellipse',
      'image',
      'button',
    ]);
    expect(SCREEN_SDK_STATIC_CAPABILITY_PROFILE.supportsBusinessFetch).toBe(false);
    expect(SCREEN_SDK_STATIC_CAPABILITY_PROFILE.supportsDynamicDataSources).toBe(false);
  });

  it.each([
    ['component', true],
    ['condition', true],
    ['delay', true],
    ['comment', true],
    ['requestApi', false],
    ['script', false],
  ])('classifies node kind %s', (kind, expected) => {
    expect(isScreenSdkBlueprintNodeKind(kind)).toBe(expected);
  });

  it.each([
    ['pageLoad', true],
    ['interval', true],
    ['navigate', true],
    ['scrollTo', true],
    ['requestApi', false],
  ])('classifies global component type %s', (globalType, expected) => {
    expect(isScreenSdkGlobalComponentType(globalType)).toBe(expected);
  });

  it('derives component, control-flow, and global handles from one profile', () => {
    expect([...getScreenSdkSourceHandles({ kind: 'component' })]).toEqual([
      'evt:click',
      'evt:hover',
    ]);
    expect([...getScreenSdkTargetHandles({ kind: 'component' })]).toEqual([
      'act:show',
      'act:hide',
      'act:toggleVisibility',
    ]);
    expect([...getScreenSdkSourceHandles({ kind: 'condition' })]).toEqual(['then', 'else']);
    expect([...getScreenSdkTargetHandles({ kind: 'component', globalType: 'navigate' })]).toEqual([
      'act:navigate',
    ]);
    expect([...getScreenSdkSourceHandles({ kind: 'component', globalType: 'requestApi' })]).toEqual(
      [],
    );
  });
});
