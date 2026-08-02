import type { GlobalRequestApiConfig } from '@nebula/shared';

import type { CompiledRule } from '../compiler/types.js';

export type TriggerEvent =
  | {
      readonly kind: 'componentEvent';
      readonly componentId: string;
      readonly eventId: string;
      readonly payload?: unknown;
    }
  | { readonly kind: 'pageLoad' }
  | { readonly kind: 'interval' };

export type ActionResult =
  | {
      readonly kind: 'success';
      readonly nodeId: string;
      readonly actionId: string;
      readonly durationMs: number;
    }
  | {
      readonly kind: 'skipped';
      readonly nodeId: string;
      readonly actionId: string;
      readonly reason: string;
    }
  | {
      readonly kind: 'failure';
      readonly nodeId: string;
      readonly actionId: string;
      readonly error: string;
      readonly durationMs: number;
    };

export interface RuleExecutionLog {
  readonly triggerNodeId: string;
  readonly triggerEventId: string;
  readonly triggerComponentId: string;
  readonly results: ActionResult[];
  readonly truncated: false;
}

export interface RequestApiRuntimeParams {
  readonly method: GlobalRequestApiConfig['method'];
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly secretHeaderKeys: string[];
  readonly timeoutMs: number;
}

export interface RequestApiRuntimeResult {
  readonly ok: boolean;
  readonly status: number;
  readonly bodyPreview: string;
}

export interface RuntimeDeps {
  readonly hasComponent: (componentId: string) => boolean;
  readonly getComponentValue: (componentId: string) => Record<string, unknown> | undefined;
  readonly getComponentData: (componentId: string) => unknown;
  readonly applyVisibility: (componentId: string, visible: boolean) => void;
  readonly getVisibility: (componentId: string) => boolean;
  readonly refreshDataSource: (componentId: string) => Promise<void>;
  readonly scrollToComponent: (componentId: string) => void;
  readonly openUrl: (url: string, target: '_blank' | '_self') => void;
  readonly requestApi: (config: RequestApiRuntimeParams) => Promise<RequestApiRuntimeResult>;
  readonly logWarning: (message: string) => void;
}

export type VisibilityOverrides = Map<string, boolean>;

export type ExecuteFunction = (
  rules: readonly CompiledRule[],
  event: TriggerEvent,
  deps: RuntimeDeps,
) => Promise<RuleExecutionLog[]>;
