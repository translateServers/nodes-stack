import type {
  ConditionExpression,
  EventBlueprint,
  GlobalNavigateConfig,
  GlobalRequestApiConfig,
} from '@nebula/shared';

export type TriggerEventId = string;

export type ActionId =
  | 'show'
  | 'hide'
  | 'toggleVisibility'
  | 'refreshData'
  | 'scrollTo'
  | 'navigate'
  | 'requestApi';

export type ActionStepConfig =
  | { readonly actionId: 'show' | 'hide' | 'toggleVisibility' | 'refreshData' | 'scrollTo' }
  | { readonly actionId: 'navigate'; readonly config: GlobalNavigateConfig }
  | { readonly actionId: 'requestApi'; readonly config: GlobalRequestApiConfig };

export interface ActionStep {
  readonly kind: 'action';
  readonly nodeId: string;
  readonly componentId: string;
  readonly config: ActionStepConfig;
}

export interface ConditionStep {
  readonly kind: 'condition';
  readonly nodeId: string;
  readonly expression: ConditionExpression;
  readonly thenSteps: CompiledStep[];
  readonly elseSteps: CompiledStep[];
}

export interface DelayStep {
  readonly kind: 'delay';
  readonly nodeId: string;
  readonly delayMs: number;
}

export type CompiledStep = ActionStep | ConditionStep | DelayStep;

export interface CompiledRule {
  readonly triggerNodeId: string;
  readonly triggerEventId: TriggerEventId;
  readonly triggerComponentId: string;
  readonly steps: CompiledStep[];
  readonly intervalMs?: number;
}

export type BlueprintDiagnosticLevel = 'error' | 'warning' | 'info';

export type BlueprintDiagnosticCode =
  | 'cycle'
  | 'dangling-component'
  | 'empty-config'
  | 'invalid-delay'
  | 'duplicate-node-id'
  | 'duplicate-edge-id'
  | 'invalid-edge-handle';

export interface BlueprintDiagnostic {
  readonly level: BlueprintDiagnosticLevel;
  readonly code: BlueprintDiagnosticCode;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

export interface CompileResult {
  readonly rules: CompiledRule[];
  readonly diagnostics: BlueprintDiagnostic[];
}

export interface CompileContext {
  readonly componentIds: ReadonlySet<string>;
}

export interface CompileInput {
  readonly blueprint: EventBlueprint;
  readonly context: CompileContext;
}

export const MAX_COMPILE_DEPTH = 100;
