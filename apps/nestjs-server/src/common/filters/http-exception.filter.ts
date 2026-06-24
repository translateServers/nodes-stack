import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorResponseDto } from '../dto/api-error-response.dto';
import { BusinessException } from '../exceptions/business.exception';
import { BizCode, BizMessage, type BizCodeValue } from '../enums/biz-code.enum';
import { ZodValidationException } from 'nestjs-zod';

interface HttpExceptionResponseLike {
  message?: string[] | string;
}

function isHttpExceptionResponseLike(response: unknown): response is HttpExceptionResponseLike {
  return typeof response === 'object' && response !== null;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{
      method: string;
      url: string;
    }>();

    // 业务异常：直接使用 BusinessException 携带的信息
    if (exception instanceof BusinessException) {
      const { bizCode, bizMessage, details } = exception;

      this.logger.warn(`[BizCode ${bizCode}]: ${bizMessage} - ${request.method} ${request.url}`);

      const errorResponse: ApiErrorResponseDto = {
        code: bizCode,
        message: bizMessage,
      };
      if (details) {
        errorResponse.details = details;
      }

      response.status(exception.getStatus()).json(errorResponse);
      return;
    }

    // 其他 HttpException：尝试解析并映射到业务码
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const { bizCode, message, details } = this.parseExceptionResponse(
      exception,
      exceptionResponse,
      status,
    );

    this.logger.warn(
      `[BizCode ${bizCode}] HTTP ${status}: ${message} - ${request.method} ${request.url}`,
    );

    const errorResponse: ApiErrorResponseDto = {
      code: bizCode,
      message,
    };
    if (details) {
      errorResponse.details = details;
    }

    response.status(status).json(errorResponse);
  }

  private parseExceptionResponse(
    exception: HttpException,
    exceptionResponse: unknown,
    httpStatus: number,
  ): {
    bizCode: BizCodeValue;
    message: string;
    details: string[] | null;
  } {
    // 字符串消息
    if (typeof exceptionResponse === 'string') {
      // 检测 JSON 解析错误（Express body parser 抛出的 SyntaxError）
      if (this.isJsonParseError(exceptionResponse)) {
        return {
          bizCode: BizCode.VALIDATION_ERROR,
          message: BizMessage[BizCode.VALIDATION_ERROR],
          details: ['请求体 JSON 格式无效，请检查语法'],
        };
      }

      return {
        bizCode: this.httpStatusToBizCode(httpStatus),
        message: exceptionResponse,
        details: null,
      };
    }

    if (!isHttpExceptionResponseLike(exceptionResponse)) {
      return {
        bizCode: BizCode.INTERNAL_ERROR,
        message: BizMessage[BizCode.INTERNAL_ERROR],
        details: null,
      };
    }

    // zod 校验异常（nestjs-zod 的 ZodValidationException）
    if (exception instanceof ZodValidationException) {
      const issues = exception.getZodError();
      const details = this.formatZodIssues(issues);
      return {
        bizCode: BizCode.VALIDATION_ERROR,
        message: BizMessage[BizCode.VALIDATION_ERROR],
        details,
      };
    }

    // 对象响应（含 class-validator 校验错误）
    if (Array.isArray(exceptionResponse.message)) {
      return {
        bizCode: BizCode.VALIDATION_ERROR,
        message: BizMessage[BizCode.VALIDATION_ERROR],
        details: exceptionResponse.message,
      };
    }

    // 检测对象形式的 JSON 解析错误
    if (
      typeof exceptionResponse.message === 'string' &&
      this.isJsonParseError(exceptionResponse.message)
    ) {
      return {
        bizCode: BizCode.VALIDATION_ERROR,
        message: BizMessage[BizCode.VALIDATION_ERROR],
        details: ['请求体 JSON 格式无效，请检查语法'],
      };
    }

    return {
      bizCode: this.httpStatusToBizCode(httpStatus),
      message:
        typeof exceptionResponse.message === 'string'
          ? exceptionResponse.message
          : BizMessage[BizCode.UNKNOWN_ERROR],
      details: null,
    };
  }

  /**
   * 检测是否为 JSON 解析错误消息
   */
  private isJsonParseError(message: string): boolean {
    return (
      message.includes('JSON') &&
      (message.includes('position') || message.includes('Unexpected token'))
    );
  }

  private formatZodIssues(error: unknown): string[] {
    if (
      !error ||
      typeof error !== 'object' ||
      !('issues' in error) ||
      !Array.isArray((error as { issues: unknown[] }).issues)
    ) {
      return [];
    }

    type ZodIssue = {
      code: string;
      path: (string | number)[];
      message: string;
      received?: unknown;
      expected?: string;
    };

    return (error as { issues: ZodIssue[] }).issues.map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : undefined;

      // 字段缺失：Zod 默认英文消息，统一替换为中文
      if (issue.code === 'invalid_type' && issue.received === undefined) {
        return field ? `${field} 为必填项` : '此字段为必填项';
      }

      // 其他校验错误：直接使用 schema 中定义的自定义消息
      return field ? `${field}: ${issue.message}` : issue.message;
    });
  }

  /**
   * 将 HTTP 状态码映射到通用业务码
   */
  private httpStatusToBizCode(httpStatus: number): BizCodeValue {
    switch (httpStatus) {
      case 400:
        return BizCode.VALIDATION_ERROR;
      case 401:
        return BizCode.UNAUTHORIZED;
      case 403:
        return BizCode.FORBIDDEN;
      case 404:
        return BizCode.NOT_FOUND;
      case 500:
        return BizCode.INTERNAL_ERROR;
      default:
        return BizCode.UNKNOWN_ERROR;
    }
  }
}
