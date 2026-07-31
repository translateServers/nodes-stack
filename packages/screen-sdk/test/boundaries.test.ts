import { resolve } from 'node:path';
import { checkBoundaries, inspectSource } from '../scripts/check-boundaries.mjs';

const SOURCE_ROOT = resolve(import.meta.dirname, '../src');
const FIXTURE_PATH = resolve(SOURCE_ROOT, 'fixture.ts');

describe('screen SDK dependency boundaries', () => {
  it('accepts the current production source graph', () => {
    expect(checkBoundaries(SOURCE_ROOT)).toEqual([]);
  });

  it.each([
    ["import { toast } from 'sonner';", 'host package is forbidden'],
    ["export { api } from '@/api';", 'application alias is forbidden'],
    ["void import('@tanstack/react-query');", 'host package is forbidden'],
    ["import '../../outside';", 'relative import escapes SDK src'],
    ["fetch('/api/data');", 'must not call fetch directly'],
    ["window.fetch('/api/data');", 'must not call fetch directly'],
  ])('rejects boundary violation: %s', (source, expectedMessage) => {
    expect(inspectSource(FIXTURE_PATH, source, SOURCE_ROOT).join('\n')).toContain(expectedMessage);
  });
});
