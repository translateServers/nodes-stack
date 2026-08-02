import textModule from './components/text-component';
import barChartModule from './components/bar-chart-component';
import rectModule from './components/rect-component';
import ellipseModule from './components/ellipse-component';
import imageModule from './components/image-component';
import buttonModule from './components/button-component';
import type { ComponentModule } from './types';

export const BUILTIN_COMPONENT_MODULES: readonly ComponentModule[] = [
  textModule,
  barChartModule,
  rectModule,
  ellipseModule,
  imageModule,
  buttonModule,
];
