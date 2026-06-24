import { Test, type TestingModule } from '@nestjs/testing';
import { HttpExceptionFilter } from './http-exception.filter';
import {
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  UnauthorizedException,
} from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception';
import { BizCode } from '../enums/biz-code.enum';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpExceptionFilter],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    function createMockHost() {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockRequest = {
        method: 'GET',
        url: '/test',
      };
      return {
        response: mockResponse,
        host: {
          switchToHttp: jest.fn().mockReturnValue({
            getResponse: () => mockResponse,
            getRequest: () => mockRequest,
          }),
        } as unknown as ArgumentsHost,
      };
    }

    it('should handle BusinessException with correct bizCode', () => {
      const { response, host } = createMockHost();

      const exception = new BusinessException(BizCode.AUTH_INVALID_CREDENTIALS);

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        code: BizCode.AUTH_INVALID_CREDENTIALS,
        message: '凭证无效（邮箱或密码错误）',
      });
    });

    it('should handle BusinessException with custom message', () => {
      const { response, host } = createMockHost();

      const exception = new BusinessException(BizCode.USER_NOT_FOUND, '自定义消息');

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith({
        code: BizCode.USER_NOT_FOUND,
        message: '自定义消息',
      });
    });

    it('should handle validation exception with array message', () => {
      const { response, host } = createMockHost();

      const exception = new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: ['email must be an email', 'password must be longer than 6 characters'],
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(response.json).toHaveBeenCalledWith({
        code: BizCode.VALIDATION_ERROR,
        message: '请求参数校验失败',
        details: ['email must be an email', 'password must be longer than 6 characters'],
      });
    });

    it('should handle generic HttpException with string message', () => {
      const { response, host } = createMockHost();

      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(response.json).toHaveBeenCalledWith({
        code: BizCode.NOT_FOUND,
        message: 'Not found',
      });
    });

    it('should handle UnauthorizedException', () => {
      const { response, host } = createMockHost();

      const exception = new UnauthorizedException('未授权');

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(response.json).toHaveBeenCalledWith({
        code: BizCode.UNAUTHORIZED,
        message: '未授权',
      });
    });
  });
});
