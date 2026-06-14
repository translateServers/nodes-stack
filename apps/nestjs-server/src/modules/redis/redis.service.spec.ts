import { Test, type TestingModule } from '@nestjs/testing';
import { createClient } from 'redis';
import { TypedConfigService } from '@/config/typed-config.service';
import { RedisService } from '@/modules/redis/redis.service';
import type { RedisConfig } from '@/config/schemas/redis.schema';

jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

const mockedCreateClient = jest.mocked(createClient) as jest.Mock;

const redisConfig: RedisConfig = {
  host: 'localhost',
  port: 6379,
  password: 'dev123456',
  db: 0,
  keyPrefix: 'nebula:',
  connectTimeout: 5000,
  maxRetries: 3,
  lazyConnect: false,
};

type MockClient = {
  connect: jest.Mock;
  quit: jest.Mock;
  ping: jest.Mock;
  on: jest.Mock;
};

function makeMockClient(overrides: Partial<MockClient> = {}): MockClient {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn(),
    ...overrides,
  };
}

describe('RedisService', () => {
  let service: RedisService;
  let mockClient: MockClient;

  beforeEach(async () => {
    mockClient = makeMockClient();
    mockedCreateClient.mockReset();
    mockedCreateClient.mockReturnValue(mockClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: TypedConfigService,
          useValue: { namespace: jest.fn().mockReturnValue(redisConfig) },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('client lazy loading', () => {
    it('should not create client before first access', () => {
      expect(createClient).not.toHaveBeenCalled();
    });

    it('should create client on first access to client getter', () => {
      void service.client;

      expect(mockedCreateClient).toHaveBeenCalledTimes(1);
    });

    it('should reuse the same client across multiple accesses', () => {
      const c1 = service.client;
      const c2 = service.client;

      expect(c1).toBe(c2);
      expect(mockedCreateClient).toHaveBeenCalledTimes(1);
    });

    it('should pass correct URL to createClient', () => {
      void service.client;

      expect(mockedCreateClient).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'redis://:dev123456@localhost:6379/0',
        }),
      );
    });

    it('should attach error and end event listeners', () => {
      void service.client;

      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('end', expect.any(Function));
    });
  });

  describe('isConnected', () => {
    it('should be false initially', () => {
      expect(service.isConnected).toBe(false);
    });
  });

  describe('ping', () => {
    it('should return false when not connected', async () => {
      // 不访问 client，_isConnected 仍为 false
      const result = await service.ping();

      expect(result).toBe(false);
    });

    it('should return true when client.ping() returns PONG', async () => {
      void service.client;
      (service as unknown as { _isConnected: boolean })._isConnected = true;

      const result = await service.ping();

      expect(result).toBe(true);
      expect(mockClient.ping).toHaveBeenCalledTimes(1);
    });

    it('should return false when client.ping() throws', async () => {
      void service.client;
      (service as unknown as { _isConnected: boolean })._isConnected = true;
      mockClient.ping.mockRejectedValueOnce(new Error('connection lost'));

      const result = await service.ping();

      expect(result).toBe(false);
    });

    it('should return false when client.ping() returns non-PONG', async () => {
      void service.client;
      (service as unknown as { _isConnected: boolean })._isConnected = true;
      mockClient.ping.mockResolvedValueOnce('OTHER');

      const result = await service.ping();

      expect(result).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('should not quit when client was never created', async () => {
      const callsBefore = mockClient.quit.mock.calls.length;
      await service.onModuleDestroy();
      const callsAfter = mockClient.quit.mock.calls.length;

      expect(callsAfter).toBe(callsBefore);
    });

    it('should call quit() and set isConnected=false when connected', async () => {
      void service.client;
      (service as unknown as { _isConnected: boolean })._isConnected = true;

      await service.onModuleDestroy();

      expect(mockClient.quit).toHaveBeenCalledTimes(1);
      expect(service.isConnected).toBe(false);
    });
  });
});
