import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { UserService } from '@/modules/user/user.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BusinessException } from '@/common/exceptions/business.exception';
import type { CreateUserDto, UpdateUserDto } from '@/modules/user/dto/user.dto';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

const mockPrismaService = {
  user: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        name: 'Test User',
      };

      const mockUser = {
        id: 'user-id',
        email: createUserDto.email,
        username: createUserDto.username,
        name: createUserDto.name,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(mockPrismaService.user.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUser);
      expect(result.email).toBe(createUserDto.email);
      expect(result.username).toBe(createUserDto.username);
    });
  });

  describe('findAll', () => {
    it('should return array of users', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          username: 'user1',
          name: 'User One',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          username: 'user2',
          name: 'User Two',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(mockPrismaService.user.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(mockUsers);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no users exist', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-id');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw BusinessException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(BusinessException);
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashed-password',
        name: 'Test User',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should return a user by username', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashed-password',
        name: 'Test User',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByUsername('testuser');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by username', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByAccount', () => {
    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashed-password',
      name: 'Test User',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    it('should return a user when account matches email', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findByAccount('test@example.com');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: 'test@example.com' }, { username: 'test@example.com' }],
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return a user when account matches username', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findByAccount('testuser');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: 'testuser' }, { username: 'testuser' }],
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when no user found for account', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.findByAccount('nonexistent');

      expect(result).toBeNull();
    });

    it('should query with both email and username in OR condition', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      await service.findByAccount('any-account');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: 'any-account' }, { username: 'any-account' }],
        },
      });
    });
  });

  describe('update', () => {
    it('should update an existing user', async () => {
      const updateUserDto: UpdateUserDto = {
        name: 'Updated Name',
      };

      const existingUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Old Name',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      const updatedUser = {
        ...existingUser,
        name: updateUserDto.name,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-id', updateUserDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: updateUserDto,
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw BusinessException when updating non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent-id', { name: 'New Name' })).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('remove', () => {
    it('should remove an existing user', async () => {
      const existingUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.delete.mockResolvedValue(existingUser);

      const result = await service.remove('user-id');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(mockPrismaService.user.delete).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
      expect(result).toBeUndefined();
    });

    it('should throw BusinessException when removing non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(BusinessException);
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid password', async () => {
      const plainPassword = 'password123';
      const hashedPassword = '$2b$10$rRzH4qk8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X';

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validatePassword(plainPassword, hashedPassword);

      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      const plainPassword = 'wrong-password';
      const hashedPassword = '$2b$10$rRzH4qk8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X';

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validatePassword(plainPassword, hashedPassword);

      expect(result).toBe(false);
    });
  });
});
