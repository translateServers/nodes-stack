import { describe, it, expect } from 'vitest';
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserResponseSchema,
} from './user.schema.js';

describe('CreateUserSchema', () => {
  const valid = {
    email: 'user@example.com',
    username: 'newuser',
    password: 'secret123',
  };

  it('should accept valid input', () => {
    expect(CreateUserSchema.parse(valid)).toEqual(valid);
  });

  it('should accept optional name', () => {
    const withName = { ...valid, name: 'Display Name' };
    expect(CreateUserSchema.parse(withName)).toEqual(withName);
  });

  it('should reject invalid email', () => {
    expect(() => CreateUserSchema.parse({ ...valid, email: 'bad' })).toThrow();
  });

  it('should reject username shorter than 3 chars', () => {
    expect(() => CreateUserSchema.parse({ ...valid, username: 'ab' })).toThrow();
  });

  it('should reject password shorter than 6 chars', () => {
    expect(() => CreateUserSchema.parse({ ...valid, password: '12345' })).toThrow();
  });
});

describe('UpdateUserSchema', () => {
  it('should accept empty object (all fields optional)', () => {
    expect(UpdateUserSchema.parse({})).toEqual({});
  });

  it('should accept partial email update', () => {
    expect(UpdateUserSchema.parse({ email: 'new@example.com' })).toEqual({
      email: 'new@example.com',
    });
  });

  it('should strip password field (omitted from schema)', () => {
    const result = UpdateUserSchema.parse({ password: 'hack', email: 'a@b.com' });
    expect(result).not.toHaveProperty('password');
    expect(result).toHaveProperty('email', 'a@b.com');
  });

  it('should reject invalid email when provided', () => {
    expect(() => UpdateUserSchema.parse({ email: 'not-email' })).toThrow();
  });
});

describe('UserResponseSchema', () => {
  const validResponse = {
    id: 'uuid-1',
    email: 'user@example.com',
    username: 'testuser',
    name: null,
    isActive: true,
    createdAt: '2025-06-01',
    updatedAt: '2025-06-01',
  };

  it('should accept valid response', () => {
    expect(UserResponseSchema.parse(validResponse)).toEqual(validResponse);
  });

  it('should accept null name', () => {
    expect(UserResponseSchema.parse({ ...validResponse, name: null }).name).toBeNull();
  });

  it('should accept undefined name', () => {
    const { name, ...withoutName } = validResponse;
    expect(UserResponseSchema.parse(withoutName).name).toBeUndefined();
  });

  it('should reject missing required fields', () => {
    expect(() => UserResponseSchema.parse({ id: '1' })).toThrow();
  });
});
