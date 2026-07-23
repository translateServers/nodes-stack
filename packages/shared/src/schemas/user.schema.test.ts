import { describe, it, expect } from 'vitest';
import { UpdateUserSchema } from './user.schema.js';

describe('UpdateUserSchema', () => {
  it('should strip password field (omitted from schema)', () => {
    const result = UpdateUserSchema.parse({ password: 'hack', email: 'a@b.com' });
    expect(result).not.toHaveProperty('password');
    expect(result).toHaveProperty('email', 'a@b.com');
  });
});
