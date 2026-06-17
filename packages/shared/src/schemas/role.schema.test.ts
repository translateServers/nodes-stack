import { describe, it, expect } from 'vitest';
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  RoleResponseSchema,
  AssignMenusSchema,
} from './role.schema.js';

describe('CreateRoleSchema', () => {
  it('should accept valid input', () => {
    const data = { name: 'admin', description: 'Admin role' };
    expect(CreateRoleSchema.parse(data)).toEqual(data);
  });

  it('should accept without optional description', () => {
    expect(CreateRoleSchema.parse({ name: 'viewer' })).toEqual({ name: 'viewer' });
  });

  it('should reject empty name', () => {
    expect(() => CreateRoleSchema.parse({ name: '' })).toThrow();
  });

  it('should reject missing name', () => {
    expect(() => CreateRoleSchema.parse({})).toThrow();
  });
});

describe('UpdateRoleSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateRoleSchema.parse({})).toEqual({});
  });

  it('should accept partial name', () => {
    expect(UpdateRoleSchema.parse({ name: 'new-name' })).toEqual({ name: 'new-name' });
  });
});

describe('RoleResponseSchema', () => {
  const valid = {
    id: 'role-1',
    name: 'admin',
    description: null,
    isActive: true,
    createdAt: '2025-06-01 10:00:00',
    updatedAt: '2025-06-01 10:00:00',
  };

  it('should accept valid response', () => {
    expect(RoleResponseSchema.parse(valid)).toEqual(valid);
  });

  it('should reject invalid datetime format', () => {
    expect(() => RoleResponseSchema.parse({ ...valid, createdAt: '2025/06/01' })).toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() => RoleResponseSchema.parse({ id: '1' })).toThrow();
  });
});

describe('AssignMenusSchema', () => {
  it('should accept array of menu ids', () => {
    const data = { menuIds: ['m1', 'm2'] };
    expect(AssignMenusSchema.parse(data)).toEqual(data);
  });

  it('should accept empty array', () => {
    expect(AssignMenusSchema.parse({ menuIds: [] })).toEqual({ menuIds: [] });
  });

  it('should reject non-array', () => {
    expect(() => AssignMenusSchema.parse({ menuIds: 'm1' })).toThrow();
  });
});
