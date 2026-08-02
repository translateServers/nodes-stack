/**
 * 全打包入口（XJ 宿主集成用）。
 *
 * 导出设计器/查看器元素、注册函数、组件注册表工厂与类型。
 * react/react-dom 由宿主提供（外部化）。
 */

export { NebulaScreenDesignerElement } from './element/nebula-screen-designer-element.js';
export { NebulaScreenViewerElement } from './element/nebula-screen-viewer-element.js';
import { NebulaScreenDesignerElement } from './element/nebula-screen-designer-element.js';
import { NebulaScreenViewerElement } from './element/nebula-screen-viewer-element.js';
export {
  defineNebulaScreenDesigner,
  defineNebulaScreenViewer,
  defineNebulaScreenDynamicElements,
  NEBULA_SCREEN_DESIGNER_TAG_NAME,
  NEBULA_SCREEN_VIEWER_TAG_NAME,
} from './element/define.js';

export {
  createXjContractFixtureRegistry,
  type CreateXjContractFixtureRegistryOptions,
} from './contract-components/index.js';

export {
  createScreenComponentRegistry,
  type CreateScreenComponentRegistryOptions,
  type ScreenComponentInstanceRegistry,
  type ScreenComponentRegistration,
} from '@nebula/screen-editor-core/experimental';

export type {
  ScreenDataAdapterPort,
  ScreenDataContextSource,
  ScreenDataExecutionContext,
  ScreenDataExecuteRequest,
  ScreenDataExecuteResult,
  ScreenDataMetricResource,
  DynamicScreenDocumentV3,
  DynamicScreenComponentWire,
  DynamicDataSourceConfig,
  HostMetricDataSource,
} from '@nebula/screen-editor-core/dynamic';

export type { ScreenComponentManifest, ScreenComponentPlugin } from '@nebula/screen-component-sdk';
export type {
  ScreenComponentDataCapability,
  ScreenComponentDataState,
  ScreenComponentElementModelV2,
  ScreenComponentHostMetricIntent,
} from '@nebula/screen-component-sdk/dynamic';

declare global {
  interface HTMLElementTagNameMap {
    'nebula-screen-designer': NebulaScreenDesignerElement;
    'nebula-screen-viewer': NebulaScreenViewerElement;
  }
}
