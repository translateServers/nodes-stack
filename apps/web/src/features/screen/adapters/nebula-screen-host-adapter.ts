import { type QueryClient } from '@tanstack/react-query';
import {
  BizCode,
  isBusinessError,
  type PublishScreenProjectParams,
  type ScreenProject,
  type UpdateScreenProjectParams,
} from '@nebula/shared';
import {
  ScreenAdapterErrorCode,
  parseScreenDocument,
  type ScreenAdapterError,
  type ScreenAdapterErrorCode as ScreenAdapterErrorCodeValue,
  type ScreenHostAdapter,
  type ScreenProjectEnvelopeInput,
  type ScreenSdkDiagnostic,
} from '@nebula/screen-sdk/contracts';
import type { ScreenPreviewRequestDetail } from '@nebula/screen-sdk';
import { getScreenProject, publishScreenProject, updateScreenProject } from '../api';
import { screenQueryKeys } from '../hooks';

export interface NebulaScreenApi {
  getProject(id: string, signal: AbortSignal): Promise<ScreenProject>;
  publishProject(
    id: string,
    params: PublishScreenProjectParams,
    signal: AbortSignal,
  ): Promise<ScreenProject>;
  updateProject(
    id: string,
    params: UpdateScreenProjectParams,
    signal: AbortSignal,
  ): Promise<ScreenProject>;
}

export interface CreateNebulaScreenHostAdapterOptions {
  api?: NebulaScreenApi;
  queryClient: QueryClient;
}

export type NebulaScreenSdkCompatibility =
  | { compatible: true }
  | {
      code: 'UNSUPPORTED_DOCUMENT_FEATURE' | 'VALIDATION';
      compatible: false;
      diagnostics: ScreenSdkDiagnostic[];
    };

type OpenPreviewWindow = (url: string, target: '_blank', features: string) => unknown;

class NebulaScreenAdapterError extends Error implements ScreenAdapterError {
  readonly code: ScreenAdapterErrorCodeValue;
  readonly recoverable?: boolean;

  constructor(code: ScreenAdapterErrorCodeValue, recoverable?: boolean) {
    super(code);
    this.name = 'ScreenAdapterError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

const DEFAULT_API: NebulaScreenApi = {
  getProject: (id, signal) => getScreenProject(id, signal),
  publishProject: (id, params, signal) => publishScreenProject(id, params, signal),
  updateProject: (id, params, signal) => updateScreenProject(id, params, signal),
};

const VALIDATION_CODES: ReadonlySet<number> = new Set([
  BizCode.VALIDATION_ERROR,
  BizCode.SCREEN_NAME_EXISTS,
  BizCode.SCREEN_PUBLISH_FAILED,
  400,
  409,
  422,
]);

function errorCodeFor(error: unknown): ScreenAdapterErrorCodeValue {
  if (!isBusinessError(error)) return ScreenAdapterErrorCode.UNKNOWN;
  if (error.code === BizCode.SCREEN_SAVE_CONFLICT) return ScreenAdapterErrorCode.CONFLICT;
  if (
    error.code === BizCode.SCREEN_NOT_FOUND ||
    error.code === BizCode.NOT_FOUND ||
    error.code === 404
  ) {
    return ScreenAdapterErrorCode.NOT_FOUND;
  }
  if (
    error.code === BizCode.UNAUTHORIZED ||
    error.code === BizCode.AUTH_INVALID_REFRESH_TOKEN ||
    error.code === 401
  ) {
    return ScreenAdapterErrorCode.UNAUTHORIZED;
  }
  if (error.code === BizCode.FORBIDDEN || error.code === 403) {
    return ScreenAdapterErrorCode.FORBIDDEN;
  }
  if (VALIDATION_CODES.has(error.code)) return ScreenAdapterErrorCode.VALIDATION;
  if (error.code === -1 || error.code === 408 || error.code === 429 || error.code >= 500) {
    return ScreenAdapterErrorCode.UNAVAILABLE;
  }
  return ScreenAdapterErrorCode.UNKNOWN;
}

export function mapNebulaScreenAdapterError(
  error: unknown,
  signal?: AbortSignal,
): ScreenAdapterError {
  if (signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')) {
    return new NebulaScreenAdapterError(ScreenAdapterErrorCode.ABORTED, true);
  }
  const code = errorCodeFor(error);
  return new NebulaScreenAdapterError(
    code,
    code === ScreenAdapterErrorCode.CONFLICT || code === ScreenAdapterErrorCode.UNAVAILABLE,
  );
}

export function screenProjectToSdkEnvelope(project: ScreenProject): ScreenProjectEnvelopeInput {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    revision: project.updatedAt,
    document: {
      schemaVersion: 1,
      canvas: project.canvas,
      components: project.components,
      blueprint: project.blueprint,
      globalVariables: project.globalVariables,
    },
  };
}

export function inspectNebulaScreenSdkCompatibility(
  project: ScreenProject,
): NebulaScreenSdkCompatibility {
  const result = parseScreenDocument(screenProjectToSdkEnvelope(project).document);
  return result.success
    ? { compatible: true }
    : {
        code: result.code,
        compatible: false,
        diagnostics: structuredClone(result.diagnostics),
      };
}

async function runAdapterOperation<Result>(
  signal: AbortSignal,
  operation: () => Promise<Result>,
): Promise<Result> {
  signal.throwIfAborted();
  try {
    const result = await operation();
    signal.throwIfAborted();
    return result;
  } catch (error) {
    throw mapNebulaScreenAdapterError(error, signal);
  }
}

export function createNebulaScreenHostAdapter({
  api = DEFAULT_API,
  queryClient,
}: CreateNebulaScreenHostAdapterOptions): ScreenHostAdapter {
  return {
    loadProject: ({ projectId, signal }) =>
      runAdapterOperation(signal, async () => {
        const project = await api.getProject(projectId, signal);
        queryClient.setQueryData(screenQueryKeys.detail(projectId), project);
        return screenProjectToSdkEnvelope(project);
      }),
    saveProject: ({ draft, projectId, revision, signal }) =>
      runAdapterOperation(signal, async () => {
        const project = await api.updateProject(
          projectId,
          {
            name: draft.name,
            description: draft.description ?? undefined,
            canvas: draft.document.canvas,
            components: draft.document.components,
            blueprint: draft.document.blueprint,
            globalVariables: draft.document.globalVariables,
            expectedUpdatedAt: revision,
          },
          signal,
        );
        queryClient.setQueryData(screenQueryKeys.detail(projectId), project);
        await queryClient.invalidateQueries({ queryKey: screenQueryKeys.all, exact: true });
        return screenProjectToSdkEnvelope(project);
      }),
    publishProject: ({ projectId, revision, signal }) =>
      runAdapterOperation(signal, async () => {
        const project = await api.publishProject(
          projectId,
          { expectedUpdatedAt: revision },
          signal,
        );
        queryClient.setQueryData(screenQueryKeys.detail(projectId), project);
        await queryClient.invalidateQueries({ queryKey: screenQueryKeys.all, exact: true });
        await queryClient.invalidateQueries({ queryKey: screenQueryKeys.preview(projectId) });
        return screenProjectToSdkEnvelope(project);
      }),
  };
}

export function openNebulaScreenEditorPreview(
  detail: Pick<ScreenPreviewRequestDetail, 'projectId'>,
  openWindow: OpenPreviewWindow = (url, target, features) => window.open(url, target, features),
): void {
  openWindow(
    `/screen-editor-preview/${encodeURIComponent(detail.projectId)}`,
    '_blank',
    'noopener,noreferrer',
  );
}
