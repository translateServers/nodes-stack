import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import { UserPayload } from '@/common/interfaces/user.interface';

/**
 * 包含用户信息的 Request 类型
 */
export interface RequestWithUser extends Request {
  user?: UserPayload;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = UserPayload>(
    err: unknown,
    user: TUser | undefined,
  ): TUser {
    if (err || !user) {
      throw new BusinessException(BizCode.UNAUTHORIZED);
    }
    return user;
  }
}
