import type {
  CommentNodeConfig,
  ConditionNodeConfig,
  GlobalIntervalConfig,
  GlobalNavigateConfig,
  GlobalRequestApiConfig,
  GlobalScrollToConfig,
} from '@nebula/shared';

export interface ComponentNodeData extends Record<string, unknown> {
  readonly componentId: string;
  readonly componentType?: string;
  readonly globalType?: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
  readonly label: string;
  readonly dangling?: boolean;
  readonly inCycle?: boolean;
}

export interface GlobalNodeData extends ComponentNodeData {
  readonly globalType: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
  readonly config?:
    | GlobalNavigateConfig
    | GlobalRequestApiConfig
    | GlobalScrollToConfig
    | GlobalIntervalConfig;
}

export interface DelayNodeData extends Record<string, unknown> {
  readonly config: { readonly delayMs: number };
  readonly label: string;
  readonly inCycle?: boolean;
}

export interface ConditionNodeData extends Record<string, unknown> {
  readonly config: ConditionNodeConfig;
  readonly label: string;
  readonly dangling?: boolean;
  readonly inCycle?: boolean;
}

export interface CommentNodeData extends Record<string, unknown> {
  readonly config: CommentNodeConfig;
  readonly label: string;
}

export type BlueprintNodeData =
  | ComponentNodeData
  | DelayNodeData
  | ConditionNodeData
  | CommentNodeData;
