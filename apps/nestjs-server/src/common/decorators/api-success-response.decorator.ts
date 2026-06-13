import { applyDecorators, SetMetadata } from '@nestjs/common';
import {
  ApiExtraModels,
  getSchemaPath,
  ApiResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import type { Type } from '@nestjs/common';
import { RESPONSE_MESSAGE_KEY } from './response-message.decorator';
import { ApiErrorResponseDto } from '@/common/dto/api-error-response.dto';

// ==================== 响应体 Schema 常量 ====================
//
// 外层 { code, data?, message } 是应用级响应包装结构，
// 由 TransformInterceptor 在运行时统一构造，不属于任何特定 DTO 的职责。
// 因此这里的 OpenAPI schema 直接手写，与 TransformInterceptor 的输出保持一致。
// 内部 data 字段通过 $ref 引用 createZodDto 生成的 schema，确保与业务 DTO 同步。

/**
 * 成功响应公共属性定义
 * 值与 TransformInterceptor 的输出保持一致
 */
const SUCCESS_BASE_PROPERTIES = {
  code: {
    type: 'number' as const,
    example: 0,
    description: '业务状态码，0 表示成功',
  },
  message: {
    type: 'string' as const,
    example: '操作成功',
    description: '响应消息',
  },
};

// ==================== Schema 构建辅助函数 ====================

function buildDataSchema<T>(type: Type<T>, isArray: boolean): Record<string, unknown> {
  return isArray
    ? { type: 'array' as const, items: { $ref: getSchemaPath(type) } }
    : { $ref: getSchemaPath(type) };
}

function buildSuccessSchema<T>(type: Type<T>, isArray: boolean): Record<string, unknown> {
  return {
    type: 'object' as const,
    properties: {
      ...SUCCESS_BASE_PROPERTIES,
      data: buildDataSchema(type, isArray),
    },
    required: ['code', 'message'],
  };
}

function buildSuccessNoDataSchema(message?: string): Record<string, unknown> {
  return {
    type: 'object' as const,
    properties: {
      ...SUCCESS_BASE_PROPERTIES,
      message: {
        ...SUCCESS_BASE_PROPERTIES.message,
        ...(message ? { example: message } : {}),
      },
    },
    required: ['code', 'message'],
  };
}

// ==================== 成功响应装饰器 ====================

interface ApiResponseOptions {
  status?: number;
  description?: string;
}

interface ApiNoDataResponseOptions extends ApiResponseOptions {
  /** 响应消息示例值，会同步设置到 @ResponseMessage 元数据 */
  message?: string;
}

/**
 * 标注接口返回数据（单对象或数组）的 Swagger 文档
 *
 * 利用 createZodDto 自动生成的 OpenAPI schema，通过 $ref 引用，
 * 确保 Swagger 文档与 Zod schema 始终一致。
 */
export function ApiSuccessResponse<T>(
  type: Type<T>,
  options: ApiResponseOptions & { isArray?: boolean } = {},
): MethodDecorator {
  const { status = 200, description = '请求成功', isArray = false } = options;

  return applyDecorators(
    ApiExtraModels(type),
    ApiResponse({
      status,
      description,
      schema: buildSuccessSchema(type, isArray),
    }),
  );
}

/**
 * 标注接口无返回数据的 Swagger 文档（如 DELETE 操作）
 *
 * 设置 message 时会同步设置 @ResponseMessage 元数据，
 * 无需额外使用 @ResponseMessage 装饰器。
 */
export function ApiSuccessNoDataResponse(options: ApiNoDataResponseOptions = {}): MethodDecorator {
  const { status = 200, description = '请求成功', message } = options;

  const decorators = [
    ApiResponse({
      status,
      description,
      schema: buildSuccessNoDataSchema(message),
    }),
  ];

  if (message) {
    decorators.push(SetMetadata(RESPONSE_MESSAGE_KEY, message));
  }

  return applyDecorators(...decorators);
}

// ==================== 全局错误响应装饰器 ====================

/**
 * 一键注入 400 / 500 错误响应文档到接口或 Controller
 *
 * 直接引用 ApiErrorResponseDto（由 createZodDto 生成），
 * 确保 Swagger 文档与 HttpExceptionFilter 统一错误响应格式一致。
 */
export function ApiGlobalErrors(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(ApiErrorResponseDto),
    ApiBadRequestResponse({
      description: '请求参数错误 (400)',
      schema: { $ref: getSchemaPath(ApiErrorResponseDto) },
    }),
    ApiInternalServerErrorResponse({
      description: '服务器内部错误 (500)',
      schema: { $ref: getSchemaPath(ApiErrorResponseDto) },
    }),
  );
}
