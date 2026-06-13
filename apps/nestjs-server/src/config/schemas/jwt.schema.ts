import { z } from 'zod';

export const JwtSchema = z.object({
  secret: z.string().min(32, 'JWT_SECRET 长度至少为 32 位'),
  accessTokenTtl: z.string().default('15m'),
  refreshTokenTtl: z.string().default('7d'),
  refreshSecret: z.string().min(32, 'JWT_REFRESH_SECRET 长度至少为 32 位'),
});

export type JwtConfig = z.infer<typeof JwtSchema>;
