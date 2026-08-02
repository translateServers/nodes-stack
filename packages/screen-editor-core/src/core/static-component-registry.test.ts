import {
  getScreenSdkComponentDefinition,
  SCREEN_SDK_COMPONENT_DEFINITIONS,
} from './static-component-registry.js';

describe('static component registry', () => {
  it('registers exactly the six V1 components', () => {
    expect(SCREEN_SDK_COMPONENT_DEFINITIONS.map(({ type }) => type)).toEqual([
      'text',
      'bar-chart',
      'rect',
      'ellipse',
      'image',
      'button',
    ]);
  });

  it('does not expose dynamic data events or actions on bar charts', () => {
    const barChart = getScreenSdkComponentDefinition('bar-chart');
    expect(barChart.events).toEqual(['click', 'hover']);
    expect(barChart.actions).toEqual(['show', 'hide', 'toggleVisibility']);
    expect(barChart.defaultDataSource?.type).toBe('static');
    expect(barChart.events).not.toContain('dataLoaded');
    expect(barChart.actions).not.toContain('refreshData');
  });
});
