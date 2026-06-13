import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    NestCacheModule.register({
      ttl: 30000,
      max: 1000,
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
