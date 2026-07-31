import { resolve } from 'node:path';
import {
  checkBoundaries,
  CORE_SOURCE_ROOT,
  inspectSource,
  SOURCE_ROOT,
} from '../scripts/check-boundaries.mjs';

const FIXTURE_PATH = resolve(SOURCE_ROOT, 'fixture.ts');

describe('screen SDK dependency boundaries', () => {
  it('accepts the current production source graph (SDK + core)', () => {
    expect(checkBoundaries()).toEqual([]);
  });

  it.each([
    ["import { toast } from 'sonner';", 'host package is forbidden'],
    ["import { toast } from 'axios';", 'host package is forbidden'],
    ["import { Link } from '@tanstack/react-router';", 'host package is forbidden'],
    ["export { api } from '@/api';", 'application alias is forbidden'],
    ["export { api } from '@nebula/web/features/screen/api';", 'application alias is forbidden'],
    [
      "import { screenApi } from 'apps/web/src/features/screen/api';",
      'application source import is forbidden',
    ],
    ["void import('@tanstack/react-query');", 'host package is forbidden'],
    ["import '../../outside';", 'relative import escapes SDK src'],
    ["fetch('/api/data');", 'must not call fetch directly'],
    ["window.fetch('/api/data');", 'must not call fetch directly'],
  ])('rejects boundary violation: %s', (source, expectedMessage) => {
    expect(inspectSource(FIXTURE_PATH, source, SOURCE_ROOT).join('\n')).toContain(expectedMessage);
  });

  it('scans the private core package for the same boundary rules', () => {
    expect(checkBoundaries(CORE_SOURCE_ROOT)).toEqual([]);
  });
});
