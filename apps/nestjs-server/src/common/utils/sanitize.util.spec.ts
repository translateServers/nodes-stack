import { sanitizeObject, sanitizeString } from './sanitize.util';

describe('sanitize.util', () => {
  describe('sanitizeObject', () => {
    it('should mask sensitive fields in object', () => {
      const input = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
        token: 'abc123',
      };

      const result = sanitizeObject(input);

      expect(result.username).toBe('john');
      expect(result.password).toBe('***');
      expect(result.email).toBe('john@example.com');
      expect(result.token).toBe('***');
    });

    it('should recursively mask nested sensitive fields', () => {
      const input = {
        user: {
          name: 'john',
          password: 'secret',
          credentials: {
            secret: 'abc',
            token: 'xyz',
          },
        },
      };

      const result = sanitizeObject(input);

      expect(result.user.name).toBe('john');
      expect(result.user.password).toBe('***');
      expect(result.user.credentials.secret).toBe('***');
      expect(result.user.credentials.token).toBe('***');
    });

    it('should use custom mask value', () => {
      const input = {
        password: 'secret123',
        username: 'john',
      };

      const result = sanitizeObject(input, '[REDACTED]');

      expect(result.password).toBe('[REDACTED]');
      expect(result.username).toBe('john');
    });

    it('should handle empty object', () => {
      const input = {};
      const result = sanitizeObject(input);

      expect(result).toEqual({});
    });

    it('should handle object with no sensitive fields', () => {
      const input = {
        name: 'john',
        age: 30,
        email: 'john@example.com',
      };

      const result = sanitizeObject(input);

      expect(result).toEqual(input);
    });

    it('should handle null values in object', () => {
      const input = {
        name: 'john',
        password: null,
        token: undefined,
      };

      const result = sanitizeObject(input);

      expect(result.name).toBe('john');
      expect(result.password).toBe('***');
      expect(result.token).toBe('***');
    });
  });

  describe('sanitizeString', () => {
    it('should mask sensitive values in string', () => {
      const input = 'password=secret123 token=abc456';
      const result = sanitizeString(input);

      expect(result).toBe('password=*** token=***');
    });

    it('should mask sensitive values with different separators', () => {
      const input = 'password:secret123 token=abc456';
      const result = sanitizeString(input);

      expect(result).toBe('password:*** token=***');
    });

    it('should use custom mask value', () => {
      const input = 'password=secret123';
      const result = sanitizeString(input, '[REDACTED]');

      expect(result).toBe('password=[REDACTED]');
    });

    it('should handle string with no sensitive data', () => {
      const input = 'username=john email=john@example.com';
      const result = sanitizeString(input);

      expect(result).toBe(input);
    });

    it('should handle empty string', () => {
      const result = sanitizeString('');

      expect(result).toBe('');
    });

    it('should mask refreshToken and accessToken', () => {
      const input = 'refreshToken=abc123 accessToken=xyz789';
      const result = sanitizeString(input);

      expect(result).toBe('refreshToken=*** accessToken=***');
    });
  });
});
