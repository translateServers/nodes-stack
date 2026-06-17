import { describe, it, expect } from 'vitest';
import {
  MenuTypeSchema,
  CreateMenuSchema,
  UpdateMenuSchema,
  MenuResponseSchema,
} from './menu.schema.js';

describe('MenuTypeSchema', () => {
  it('should accept DIRECTORY', () => {
    expect(MenuTypeSchema.parse('DIRECTORY')).toBe('DIRECTORY');
  });

  it('should accept MENU', () => {
    expect(MenuTypeSchema.parse('MENU')).toBe('MENU');
  });

  it('should accept BUTTON', () => {
    expect(MenuTypeSchema.parse('BUTTON')).toBe('BUTTON');
  });

  it('should reject invalid type', () => {
    expect(() => MenuTypeSchema.parse('INVALID')).toThrow();
  });
});

describe('CreateMenuSchema', () => {
  const valid = { name: '系统管理', type: 'MENU' as const };

  it('should accept minimal valid input', () => {
    expect(CreateMenuSchema.parse(valid)).toEqual(valid);
  });

  it('should accept all optional fields', () => {
    const full = {
      ...valid,
      path: '/system',
      icon: 'Settings',
      component: '/pages/System',
      parentId: 'parent-1',
      sort: 5,
      permission: 'system:manage',
      isVisible: false,
    };
    expect(CreateMenuSchema.parse(full)).toEqual(full);
  });

  it('should reject empty name', () => {
    expect(() => CreateMenuSchema.parse({ name: '', type: 'MENU' })).toThrow();
  });

  it('should reject invalid type', () => {
    expect(() => CreateMenuSchema.parse({ name: 'test', type: 'LINK' })).toThrow();
  });
});

describe('UpdateMenuSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateMenuSchema.parse({})).toEqual({});
  });

  it('should accept partial fields', () => {
    expect(UpdateMenuSchema.parse({ name: 'new', sort: 3 })).toEqual({
      name: 'new',
      sort: 3,
    });
  });
});

describe('MenuResponseSchema', () => {
  const valid = {
    id: 'menu-1',
    name: 'Dashboard',
    type: 'MENU' as const,
    path: '/dashboard',
    icon: 'Home',
    component: '/pages/Dashboard',
    parentId: null,
    sort: 0,
    permission: null,
    isVisible: true,
    createdAt: '2025-06-01 10:00:00',
    updatedAt: '2025-06-01 10:00:00',
  };

  it('should accept valid response', () => {
    expect(MenuResponseSchema.parse(valid)).toEqual(valid);
  });

  it('should reject missing required fields', () => {
    expect(() => MenuResponseSchema.parse({ id: '1' })).toThrow();
  });

  it('should reject invalid datetime', () => {
    expect(() =>
      MenuResponseSchema.parse({ ...valid, createdAt: 'bad-date' }),
    ).toThrow();
  });
});
