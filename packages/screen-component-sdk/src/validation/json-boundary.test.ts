import { describe, expect, it } from 'vitest';
import type { ScreenComponentValidationDiagnostic } from '../contracts/diagnostic.js';
import { checkJsonValue } from './json-boundary.js';

describe('checkJsonValue', () => {
  it('accepts a shared plain-object reference that is not cyclic', () => {
    const shared = { enabled: true };
    const diagnostics: ScreenComponentValidationDiagnostic[] = [];

    const valid = checkJsonValue({ primary: shared, secondary: shared }, ['props'], diagnostics);

    expect(valid).toBe(true);
    expect(diagnostics).toEqual([]);
  });

  it('rejects a true cycle while reporting the recursive path', () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    const diagnostics: ScreenComponentValidationDiagnostic[] = [];

    const valid = checkJsonValue(value, ['props'], diagnostics);

    expect(valid).toBe(false);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'INVALID_JSON_VALUE', path: ['props', 'self'] }),
    );
  });

  it('can omit undefined object properties without accepting undefined array items', () => {
    const objectDiagnostics: ScreenComponentValidationDiagnostic[] = [];
    const arrayDiagnostics: ScreenComponentValidationDiagnostic[] = [];

    expect(
      checkJsonValue(
        { optional: undefined, nested: { optional: undefined, value: 'ok' } },
        ['style'],
        objectDiagnostics,
        new WeakSet(),
        { allowUndefinedObjectProperties: true },
      ),
    ).toBe(true);
    expect(
      checkJsonValue([undefined], ['style'], arrayDiagnostics, new WeakSet(), {
        allowUndefinedObjectProperties: true,
      }),
    ).toBe(false);
  });
});
