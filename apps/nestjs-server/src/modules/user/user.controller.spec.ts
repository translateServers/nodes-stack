import { Test, type TestingModule } from '@nestjs/testing';
import { UserController } from '@/modules/user/user.controller';
import { UserService } from '@/modules/user/user.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import { BizCode } from '@/common/enums/biz-code.enum';
import type { CreateUserDto, UpdateUserDto, UserResponse } from '@/modules/user/dto/user.dto';

const mockUserService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

function createUserResponse(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: 'user-id',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    isActive: true,
    createdAt: '2025-06-01T10:00:00.000Z',
    updatedAt: '2025-06-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call userService.create and return UserResponse', async () => {
      const dto: CreateUserDto = {
        email: 'new@example.com',
        username: 'newuser',
        password: 'password123',
        name: 'New User',
      };
      const expected = createUserResponse({ email: dto.email, username: dto.username });
      mockUserService.create.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(mockUserService.create).toHaveBeenCalledTimes(1);
      expect(mockUserService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const u1 = createUserResponse({ id: '1', username: 'u1' });
      const u2 = createUserResponse({ id: '2', username: 'u2' });
      mockUserService.findAll.mockResolvedValue([u1, u2]);

      const result = await controller.findAll();

      expect(mockUserService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
    });

    it('should return empty array when no users', async () => {
      mockUserService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      const expected = createUserResponse({ id: 'specific-id' });
      mockUserService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne('specific-id');

      expect(mockUserService.findOne).toHaveBeenCalledWith('specific-id');
      expect(result.id).toBe('specific-id');
    });

    it('should propagate BusinessException when user not found', async () => {
      mockUserService.findOne.mockRejectedValue(new BusinessException(BizCode.USER_NOT_FOUND));

      await expect(controller.findOne('missing')).rejects.toThrow(BusinessException);
    });
  });

  describe('update', () => {
    it('should call userService.update with id and dto', async () => {
      const dto: UpdateUserDto = { name: '新名称' };
      const expected = createUserResponse({ id: 'u1', name: '新名称' });
      mockUserService.update.mockResolvedValue(expected);

      const result = await controller.update('u1', dto);

      expect(mockUserService.update).toHaveBeenCalledWith('u1', dto);
      expect(result.name).toBe('新名称');
    });

    it('should support partial updates (only email changed)', async () => {
      const dto: UpdateUserDto = { email: 'newemail@example.com' };
      const expected = createUserResponse({ email: 'newemail@example.com' });
      mockUserService.update.mockResolvedValue(expected);

      const result = await controller.update('u1', dto);

      expect(mockUserService.update).toHaveBeenCalledWith('u1', dto);
      expect(result.email).toBe('newemail@example.com');
    });
  });

  describe('remove', () => {
    it('should call userService.remove and return undefined', async () => {
      mockUserService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('del-id');

      expect(mockUserService.remove).toHaveBeenCalledWith('del-id');
      expect(result).toBeUndefined();
    });
  });
});
