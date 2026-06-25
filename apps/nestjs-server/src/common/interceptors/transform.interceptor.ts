import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseType } from '../dto/api-response.dto';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { BizCode, BizMessage } from '../enums/biz-code.enum';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponseType<T>> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponseType<T>> {
    return next.handle().pipe(
      map((data: T) => {
        const responseMessage = this.reflector.get<string>(
          RESPONSE_MESSAGE_KEY,
          context.getHandler(),
        );

        const response: ApiResponseType<T> = {
          code: BizCode.SUCCESS,
          message: responseMessage || BizMessage[BizCode.SUCCESS],
        };

        // 有数据时才携带 data 字段（如 DELETE 等无返回数据的操作）
        if (data !== undefined && data !== null) {
          response.data = data;
        }

        return response;
      }),
    );
  }
}
