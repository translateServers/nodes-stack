export type ScreenProjectStatus = 'draft' | 'published';

export interface ScreenProject {
  id: string;
  name: string;
  description?: string | null;
  canvas: CanvasConfig;
  components: ScreenComponent[];
  status: ScreenProjectStatus;
  thumbnail?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ScaleMode = 'fit' | 'full' | 'width' | 'height' | 'none';

export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage?: string;
  scaleMode: ScaleMode;
}

export interface ScreenComponent {
  id: string;
  type: string;
  name: string;
  position: ComponentPosition;
  style: ComponentStyle;
  props: Record<string, unknown>;
  dataSource?: DataSourceConfig;
  status: ComponentStatus;
  zIndex: number;
  parentId?: string | null;
}

export interface ComponentPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface ComponentStyle {
  opacity?: number;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderRadius?: number;
  backgroundColor?: string;
  fontSize?: number;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  overflow?: 'visible' | 'hidden' | 'auto';
}

export interface ComponentStatus {
  locked: boolean;
  hidden: boolean;
}

export type DataSourceType = 'static' | 'api';

export interface DataSourceConfig {
  type: DataSourceType;
  staticData?: unknown;
  apiConfig?: ApiDataSourceConfig;
}

export interface ApiDataSourceConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  refreshInterval?: number;
}

export type ComponentCategory = 'chart' | 'text' | 'media' | 'decoration' | 'table' | 'container';

export interface ComponentDefinition {
  type: string;
  name: string;
  category: ComponentCategory;
  icon?: string;
  thumbnail?: string;
  defaultProps: Record<string, unknown>;
  defaultSize: { width: number; height: number };
  defaultStyle?: Partial<ComponentStyle>;
}
