import { z } from 'zod';

export const ScreenSdkDiagnosticCode = {
  INVALID_DOCUMENT: 'INVALID_DOCUMENT',
  UNSUPPORTED_SCHEMA_VERSION: 'UNSUPPORTED_SCHEMA_VERSION',
  UNKNOWN_COMPONENT_TYPE: 'UNKNOWN_COMPONENT_TYPE',
  INVALID_COMPONENT_PROPS: 'INVALID_COMPONENT_PROPS',
  UNSUPPORTED_DATA_SOURCE: 'UNSUPPORTED_DATA_SOURCE',
  UNSUPPORTED_GLOBAL_VARIABLE_TYPE: 'UNSUPPORTED_GLOBAL_VARIABLE_TYPE',
  UNSUPPORTED_BLUEPRINT_NODE: 'UNSUPPORTED_BLUEPRINT_NODE',
  UNSUPPORTED_BLUEPRINT_EVENT: 'UNSUPPORTED_BLUEPRINT_EVENT',
  UNSUPPORTED_BLUEPRINT_ACTION: 'UNSUPPORTED_BLUEPRINT_ACTION',
  DANGLING_COMPONENT_REFERENCE: 'DANGLING_COMPONENT_REFERENCE',
} as const;

export type ScreenSdkDiagnosticCode =
  (typeof ScreenSdkDiagnosticCode)[keyof typeof ScreenSdkDiagnosticCode];

export const ScreenSdkDiagnosticCodeSchema = z.enum(ScreenSdkDiagnosticCode);

export const ScreenSdkDiagnosticSchema = z
  .object({
    code: ScreenSdkDiagnosticCodeSchema,
    path: z.array(z.union([z.string(), z.number().int()])),
    severity: z.enum(['error', 'warning']),
    message: z.string(),
  })
  .strict();

export type ScreenSdkDiagnostic = z.infer<typeof ScreenSdkDiagnosticSchema>;

export function createDiagnostic(
  code: ScreenSdkDiagnosticCode,
  path: ReadonlyArray<string | number>,
  message: string,
): ScreenSdkDiagnostic {
  return {
    code,
    path: [...path],
    severity: 'error',
    message,
  };
}

export function diagnosticsFromZodError(
  error: z.ZodError,
  pathPrefix: ReadonlyArray<string | number> = [],
): ScreenSdkDiagnostic[] {
  return error.issues.map((issue) => {
    const issuePath = issue.path.map((segment) =>
      typeof segment === 'symbol' ? (segment.description ?? 'symbol') : segment,
    );
    return createDiagnostic(
      ScreenSdkDiagnosticCode.INVALID_DOCUMENT,
      [...pathPrefix, ...issuePath],
      issue.message,
    );
  });
}
