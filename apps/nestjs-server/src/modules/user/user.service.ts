import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { PrismaService } from '@/prisma/prisma.service';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import {
  type CreateUserDto,
  type UpdateUserDto,
  type UserResponse,
  UserResponseSchema,
} from '@/modules/user/dto/user.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponse> {
    // 邮箱/用户名唯一性由调用方（如 AuthService.register）前置校验，
    // 此处依赖数据库唯一约束作为最终防线。
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const created = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
      select: this.userSelect,
    });

    return UserResponseSchema.parse(created);
  }

  async findAll(): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      select: this.userSelect,
    });
    return users.map((user) => UserResponseSchema.parse(user));
  }

  async findOne(id: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSelect,
    });

    if (!user) {
      throw new BusinessException(BizCode.USER_NOT_FOUND);
    }

    return UserResponseSchema.parse(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * 根据账号（邮箱或用户名）查找用户
   * @param account 用户账号（邮箱或用户名）
   * @returns 用户信息或 null
   */
  async findByAccount(account: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: account }, { username: account }],
      },
    });
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponse> {
    await this.findOne(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: this.userSelect,
    });

    return UserResponseSchema.parse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.user.delete({
      where: { id },
    });
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private readonly userSelect = {
    id: true,
    email: true,
    username: true,
    name: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}
