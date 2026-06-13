/**
 * 通用响应类型，data 字段泛型化。
 *
 * 仅作为类型层使用，供 TransformInterceptor 描述输出结构。
 * Swagger 文档中的响应包装结构由 ApiSuccessResponse 等装饰器直接定义
 * （见 api-success-response.decorator.ts），因为外层 { code, data?, message }
 * 是应用级约定，不属于某个特定 DTO 的职责。
 *
 * 错误响应请使用 ApiErrorResponseDto / ApiErrorResponseSchema。
 */
export type ApiResponseType<T> = {
  code: number;
  data?: T;
  message: string;
};
