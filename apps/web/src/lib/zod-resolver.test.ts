import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodResolver } from './zod-resolver';

const TestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().min(0, 'Age must be positive'),
});

describe('zodResolver', () => {
  it('should return values on valid input', async () => {
    const resolver = zodResolver(TestSchema);
    const result = await resolver({ name: 'Alice', age: 25 });

    expect(result).toEqual({
      values: { name: 'Alice', age: 25 },
      errors: {},
    });
  });

  it('should return errors on invalid input', async () => {
    const resolver = zodResolver(TestSchema);
    const result = await resolver({ name: '', age: -1 });

    expect(result.values).toEqual({});
    expect(result.errors).toHaveProperty('name');
    expect(result.errors).toHaveProperty('age');
    expect(result.errors.name.message).toBe('Name is required');
  });

  it('should only report first error per field', async () => {
    const Schema = z.object({
      email: z.string().min(1).email(),
    });
    const resolver = zodResolver(Schema);
    const result = await resolver({ email: '' });

    const errorKeys = Object.keys(result.errors);
    expect(errorKeys).toEqual(['email']);
  });

  it('should handle nested path in errors', async () => {
    const Schema = z.object({
      address: z.object({
        city: z.string().min(1, 'City required'),
      }),
    });
    const resolver = zodResolver(Schema);
    const result = await resolver({ address: { city: '' } });

    expect(result.errors).toHaveProperty('address.city');
  });
});
