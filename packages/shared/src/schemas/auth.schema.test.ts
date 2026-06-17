import { describe, it, expect } from 'vitest';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  TokenResponseSchema,
  CaptchaResponseSchema,
} from './auth.schema.js';

describe('RegisterSchema', () => {
  const valid = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
  };

  it('should accept valid input', () => {
    expect(RegisterSchema.parse(valid)).toEqual(valid);
  });

  it('should accept optional name', () => {
    const withName = { ...valid, name: 'Test User' };
    expect(RegisterSchema.parse(withName)).toEqual(withName);
  });

  it('should reject invalid email', () => {
    expect(() => RegisterSchema.parse({ ...valid, email: 'not-email' })).toThrow();
  });

  it('should reject short username', () => {
    expect(() => RegisterSchema.parse({ ...valid, username: 'ab' })).toThrow();
  });

  it('should reject short password', () => {
    expect(() => RegisterSchema.parse({ ...valid, password: '12345' })).toThrow();
  });

  it('should reject missing email', () => {
    expect(() => RegisterSchema.parse({ username: 'test', password: '123456' })).toThrow();
  });
});

describe('LoginSchema', () => {
  const valid = {
    account: 'admin',
    password: 'pass',
    captchaId: 'uuid-123',
    captchaCode: 'abcd',
  };

  it('should accept valid input', () => {
    expect(LoginSchema.parse(valid)).toEqual(valid);
  });

  it('should reject empty account', () => {
    expect(() => LoginSchema.parse({ ...valid, account: '' })).toThrow();
  });

  it('should reject empty password', () => {
    expect(() => LoginSchema.parse({ ...valid, password: '' })).toThrow();
  });

  it('should reject empty captchaId', () => {
    expect(() => LoginSchema.parse({ ...valid, captchaId: '' })).toThrow();
  });

  it('should reject empty captchaCode', () => {
    expect(() => LoginSchema.parse({ ...valid, captchaCode: '' })).toThrow();
  });
});

describe('RefreshTokenSchema', () => {
  it('should accept valid token', () => {
    expect(RefreshTokenSchema.parse({ refreshToken: 'jwt-token' })).toEqual({
      refreshToken: 'jwt-token',
    });
  });

  it('should reject empty token', () => {
    expect(() => RefreshTokenSchema.parse({ refreshToken: '' })).toThrow();
  });
});

describe('TokenResponseSchema', () => {
  it('should accept valid token pair', () => {
    const data = { accessToken: 'access', refreshToken: 'refresh' };
    expect(TokenResponseSchema.parse(data)).toEqual(data);
  });

  it('should reject missing accessToken', () => {
    expect(() => TokenResponseSchema.parse({ refreshToken: 'r' })).toThrow();
  });
});

describe('CaptchaResponseSchema', () => {
  it('should accept valid captcha response', () => {
    const data = { captchaId: 'id-1', captchaImage: '<svg></svg>' };
    expect(CaptchaResponseSchema.parse(data)).toEqual(data);
  });

  it('should reject empty captchaId', () => {
    expect(() => CaptchaResponseSchema.parse({ captchaId: '', captchaImage: 'svg' })).toThrow();
  });
});
