/**
 * 动态组件契约测试：dataCapability 声明、v2 model 与 dataState 边界。
 *
 * 测业务约束：数据能力声明与数据源支持关系、v2 model 快照语义。
 */

import { describe, expect, it } from 'vitest';

import {
  SCREEN_COMPONENT_API_VERSION_V2,
  SCREEN_COMPONENT_DATA_CAPABILITIES,
  supportsScreenComponentDataSource,
  type ScreenComponentDataState,
  type ScreenComponentElementModelV2,
} from './index.js';

describe('dynamic data capability 契约', () => {
  it('dataCapability 只接受三个固定值', () => {
    expect(SCREEN_COMPONENT_DATA_CAPABILITIES).toEqual(['none', 'static', 'host-metric']);
    const capability = SCREEN_COMPONENT_DATA_CAPABILITIES[0];
    expect(capability).toBe('none');
  });

  it('static 与 host-metric 允许数据源，none 不允许', () => {
    expect(supportsScreenComponentDataSource('static')).toBe(true);
    expect(supportsScreenComponentDataSource('host-metric')).toBe(true);
    expect(supportsScreenComponentDataSource('none')).toBe(false);
  });

  it('v2 apiVersion 与 v1 区分', () => {
    expect(SCREEN_COMPONENT_API_VERSION_V2).toBe('nebula.screen-component/v2');
  });
});

describe('v2 model 快照语义', () => {
  it('v2 model 携带 dataCapability 与 dataState', () => {
    const model: ScreenComponentElementModelV2 = {
      apiVersion: 2,
      componentId: 'c1',
      mode: 'viewer',
      interactive: false,
      props: { text: 'hello' },
      style: { color: '#fff' },
      size: { width: 100, height: 50 },
      dataCapability: 'host-metric',
      dataState: { status: 'success', data: { value: 42 } },
    };
    expect(model.apiVersion).toBe(2);
    expect(model.mode).toBe('viewer');
    expect(model.dataCapability).toBe('host-metric');
    expect(model.dataState).toMatchObject({ status: 'success', data: { value: 42 } });
  });

  it('error dataState 携带 reason 边界', () => {
    const state: ScreenComponentDataState = {
      status: 'error',
      error: { message: 'boom', reason: 'timeout' },
    };
    expect(state.status).toBe('error');
    expect(state.error.reason).toBe('timeout');
  });

  it('model 是 detached snapshot：修改 props 不产生共享引用问题（结构化克隆语义）', () => {
    const model: ScreenComponentElementModelV2 = {
      apiVersion: 2,
      componentId: 'c1',
      mode: 'preview',
      interactive: false,
      props: { nested: { value: 1 } },
      style: {},
      size: { width: 100, height: 50 },
      dataCapability: 'static',
      dataState: { status: 'idle' },
    };
    const clone: ScreenComponentElementModelV2 = {
      ...structuredClone(model),
      props: { ...model.props, nested: { value: 2 } },
    };
    expect(clone.props['nested']).toEqual({ value: 2 });
    expect(model.props['nested']).toEqual({ value: 1 });
  });
});
