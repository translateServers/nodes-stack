import { HttpException } from '@nestjs/common';
import { BizMessage, getHttpStatus, type BizCodeValue } from '../enums/biz-code.enum';

/**
 * 业务异常类
 *
 * 用于替代 NestJS 内置的 HttpException，统一携带业务码信息。
 * 所有业务逻辑中的异常都应使用此类抛出。
 *
 * @example
 * ```typescript
 * throw new BusinessException(BizCode.USER_NOT_FOUND);
 * throw new BusinessException(BizCode.MENU_ALREADY_EXISTS, '自定义消息');
 * ```
 */
export class BusinessException extends HttpException {
  /** 业务状态码 */
  public readonly bizCode: BizCodeValue;
  /** 业务消息 */
  public readonly bizMessage: string;
  /** 附加详情（如参数校验错误列表） */
  public readonly details?: string[];

  constructor(bizCode: BizCodeValue, message?: string, details?: string[]) {
    const resolvedMessage = message ?? BizMessage[bizCode] ?? '未知错误';
    const httpStatus = getHttpStatus(bizCode);

    super(
      {
        bizCode,
        message: resolvedMessage,
        details,
      },
      httpStatus,
    );

    this.bizCode = bizCode;
    this.bizMessage = resolvedMessage;
    this.details = details;
  }
}
