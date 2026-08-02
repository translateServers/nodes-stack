import { Injectable, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard as NestThrottlerGuard,
  type ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { SKIP_THROTTLE_KEY } from '../decorators/skip-throttle.decorator';

export function isE2ETestEnvironment(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV === 'test' && environment.E2E_TEST_MODE === 'true';
}

@Injectable()
export class ThrottlerGuard extends NestThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    // The Playwright harness starts a disposable server and database for concurrent browser tests.
    // Production and ordinary test environments retain the configured rate limits.
    if (isE2ETestEnvironment()) {
      return true;
    }

    const skipThrottle = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipThrottle) {
      return true;
    }

    return super.canActivate(context);
  }
}
