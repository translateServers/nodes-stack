import { isE2ETestEnvironment } from './throttler.guard';

describe('isE2ETestEnvironment', () => {
  it('only enables the E2E throttle bypass for an explicit test environment', () => {
    expect(isE2ETestEnvironment({ NODE_ENV: 'test', E2E_TEST_MODE: 'true' })).toBe(true);
    expect(isE2ETestEnvironment({ NODE_ENV: 'test' })).toBe(false);
    expect(isE2ETestEnvironment({ NODE_ENV: 'production', E2E_TEST_MODE: 'true' })).toBe(false);
  });
});
