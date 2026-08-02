/**
 * screen-dynamic-sdk 主入口。
 *
 * 导出设计器/查看器元素类、注册函数、公共契约与测试工具。
 * 注意：本包只声明数据意图，不经手 Token/URL/SQL；
 * 数据由宿主 ScreenDataAdapterPort 委托执行。
 */

import { NebulaScreenDesignerElement } from './element/nebula-screen-designer-element.js';
import { NebulaScreenViewerElement } from './element/nebula-screen-viewer-element.js';

export { NebulaScreenDesignerElement } from './element/nebula-screen-designer-element.js';
export { NebulaScreenViewerElement } from './element/nebula-screen-viewer-element.js';
export {
  defineNebulaScreenDesigner,
  defineNebulaScreenViewer,
  defineNebulaScreenDynamicElements,
  isNebulaScreenDynamicElement,
  NEBULA_SCREEN_DESIGNER_TAG_NAME,
  NEBULA_SCREEN_VIEWER_TAG_NAME,
} from './element/define.js';
export { ScreenDynamicElementBase } from './element/base-element.js';

export {
  createXjContractFixtureRegistry,
  type CreateXjContractFixtureRegistryOptions,
  XJ_CHART_BAR_MANIFEST,
  XJ_CHART_BAR_TAG_NAME,
  XJ_METRIC_CARD_MANIFEST,
  XJ_METRIC_CARD_TAG_NAME,
} from './contract-components/index.js';

export type {
  ScreenDynamicDesignerConfiguration,
  ScreenDynamicElementConfig,
  ScreenDynamicEventMap,
  ScreenDynamicMountOptions,
  ScreenDynamicRuntime,
  ScreenDynamicSdkOptions,
  ScreenDynamicViewerConfiguration,
} from './element/contracts.js';

export type {
  DynamicScreenDocumentV3,
  DynamicDataSourceConfig,
  DynamicScreenComponentWire,
  HostMetricDataSource,
  ScreenDataAdapterPort,
  ScreenDataContextSource,
  ScreenDataExecutionContext,
  ScreenDataExecuteRequest,
  ScreenDataExecuteResult,
  ScreenDataMetricResource,
} from '@nebula/screen-editor-core/dynamic';

declare global {
  interface HTMLElementTagNameMap {
    'nebula-screen-designer': NebulaScreenDesignerElement;
    'nebula-screen-viewer': NebulaScreenViewerElement;
  }
}
