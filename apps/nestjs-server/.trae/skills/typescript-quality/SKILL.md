---
name: "typescript-quality"
description: "提供 TypeScript 和 ESLint 零错误编码规范、Prettier 格式规则、常见陷阱解法、测试编写模式。当编写代码、编写测试、处理复杂类型定义、或用户需要类型安全代码指导时调用。"
---

# TypeScript Quality Guide

本 Skill 提供详细的 TypeScript 和 ESLint 编码规范，确保生成的代码零错误。

## 使用场景

- 编写任何 TypeScript 代码时（确保格式和类型正确）
- 编写单元测试时（避免 mock 类型问题）
- 处理复杂类型定义时
- 遇到 ESLint 或 TypeScript 错误需要解决方案时
- 需要参考项目编码规范时

## 📝 Prettier 格式规范 (ESLint 集成)

**以下格式规则会被 ESLint 检查，必须在生成代码时就遵守：**

### 1. 引号规则
- 所有字符串使用**单引号** `'`，禁止双引号 `"`
- JSX/TSX 中使用双引号（如适用）
- 模板字符串使用反引号 `` ` ``

```typescript
// ✅ 正确
import { Injectable } from '@nestjs/common';
const name = '张三';

// ❌ 错误
import { Injectable } from "@nestjs/common";
const name = "张三";
```

### 2. 尾随逗号
- 所有多行对象、数组、函数参数**必须**添加尾随逗号

```typescript
// ✅ 正确
const user = {
  id: 1,
  name: '张三',
  email: 'zhang@example.com',
};

const result = await prisma.user.create({
  data: {
    email,
    password,
  },
});

// ❌ 错误
const user = {
  id: 1,
  name: '张三'
};
```

### 3. 缩进规则
- 使用 **2 空格** 缩进，禁止使用 Tab
- 嵌套结构每层增加 2 空格

```typescript
// ✅ 正确
async function createUser(data: CreateUserDto): Promise<User> {
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: data.password,
    },
  });
  return user;
}

// ❌ 错误（4 空格或 Tab）
async function createUser(data: CreateUserDto): Promise<User> {
    const user = await prisma.user.create({
        data: {
            email: data.email,
        },
    });
    return user;
}
```

### 4. 行长度限制
- 最大行长度 **100 字符**
- 超过限制必须换行

```typescript
// ✅ 正确
const result = await prisma.user.findMany({
  where: {
    status: 'active',
    role: 'admin',
  },
  select: {
    id: true,
    email: true,
  },
});

// ❌ 错误（超过 100 字符未换行）
const result = await prisma.user.findMany({ where: { status: 'active', role: 'admin' }, select: { id: true, email: true } });
```

### 5. 对象/数组换行规则
- 对象/数组内容超过 1 行时，大括号必须换行
- 单行对象尽量保持在行长度限制内

```typescript
// ✅ 正确 - 多行对象
const config = {
  timeout: 5000,
  retries: 3,
};

// ✅ 正确 - 单行对象（短小）
const point = { x: 1, y: 2 };

// ❌ 错误 - 应该换行但未换行
const config = { timeout: 5000, retries: 3 };
```

### 6. 空行规则
- 禁止连续 2 个以上空行
- 代码块之间保持 1 个空行

```typescript
// ✅ 正确
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string): Promise<User> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}

// ❌ 错误 - 多个连续空行
import { Injectable } from '@nestjs/common';


@Injectable()
export class UserService {
```

### 7. 分号规则
- 语句末尾**不需要**分号（Prettier 会自动处理）
- 不要手动添加多余分号

### 8. 箭头函数空格
- 箭头函数参数括号与箭头之间需要空格
- 箭头与函数体之间需要空格

```typescript
// ✅ 正确
const users = data.map((item) => item.name);
const filtered = list.filter((x) => x > 0);

// ❌ 错误
const users = data.map((item)=> item.name);
```

## 类型定义先行

**错误写法** (先写逻辑后补类型):
```typescript
export function handleData(data) {  // any 类型
  return data.map(item => item.name);
}
```

**正确写法** (类型先行):
```typescript
interface DataItem {
  id: string;
  name: string;
}

export function handleData(data: DataItem[]): string[] {
  return data.map(item => item.name);
}
```

## 处理可空值的标准模式

### 场景1: 可能不存在的属性访问

```typescript
// ❌ 错误 - 可能报 'undefined' 错误
const name = user.profile.name;

// ✅ 正确 - 使用可选链
const name = user.profile?.name;

// ✅ 更好 - 提供默认值
const name = user.profile?.name ?? 'Unknown';
```

### 场景2: 函数返回值可能为 null

```typescript
// ❌ 错误 - 直接调用可能为 null 的方法
const user = await this.findOne(id);
return user.email;

// ✅ 正确 - 先检查
const user = await this.findOne(id);
if (!user) {
  throw new NotFoundException(`User with ID ${id} not found`);
}
return user.email;
```

### 场景3: Map/数组查找

```typescript
// ❌ 错误 - Map.get() 可能返回 undefined
const code = captchaStore.get(id).code;

// ✅ 正确 - 先检查再访问
const captchaData = captchaStore.get(id);
if (!captchaData) {
  throw new BadRequestException('Invalid captcha ID');
}
const code = captchaData.code;
```

## Promise 处理标准

```typescript
// ❌ 错误 - floating promise (被忽略)
this.saveToDatabase(data);

// ✅ 正确 - await
await this.saveToDatabase(data);

// ✅ 正确 - 显式忽略 (需要注释说明原因)
void this.saveToDatabase(data);  // 不需要等待结果

// ❌ 错误 - Promise.all 中的 floating promise
promises.map(p => p.then(console.log));

// ✅ 正确
await Promise.all(promises.map(p => p.then(console.log)));
```

## 常见类型陷阱及解法

### Jest mock 的 mock.calls 类型

```typescript
// ❌ 错误 - mock.calls 是 any[] 类型
const args = mockFn.mock.calls[0];
expect(args[0].where).toEqual({...});  // ESLint 报错

// ✅ 正确 - 使用 toHaveBeenCalledWith 替代
expect(mockFn).toHaveBeenCalledWith({
  where: {...},
});

// ✅ 正确 - 使用 toHaveBeenNthCalledWith
expect(mockFn).toHaveBeenNthCalledWith(1, {
  where: {...},
});
```

### expect matchers 返回 any

```typescript
// ❌ 错误 - expect.anything() 返回 any
expect(mockFn).toHaveBeenCalledWith({
  select: expect.anything(),  // ESLint 报错
});

// ✅ 正确 - 使用具体值
expect(mockFn).toHaveBeenCalledWith({
  select: {
    id: true,
    email: true,
  },
});
```

### bcrypt 等外部库 mock

```typescript
// ✅ 在文件顶部统一 mock
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

// 使用时需要类型断言 (这是合理的 as 使用场景)
(bcrypt.compare as jest.Mock).mockResolvedValue(true);
```

## 代码结构约定

```typescript
// 1. 外部导入
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

// 2. 内部导入
import { UserService } from './user.service';

// 3. 类型定义 (如有)
interface MockUser {
  id: string;
  email: string;
}

// 4. Mock 定义 (测试文件中)
const mockPrismaService = {
  user: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

// 5. 测试/逻辑代码
describe('UserService', () => {
  ...
});
```

## 编写测试的特殊规则

### 避免 any 的测试模式

| 不要这样写 | 应该这样写 |
|-----------|-----------|
| `expect(mockFn.mock.calls[0][0].where)` | `expect(mockFn).toHaveBeenCalledWith(...)` |
| `expect(mockFn.mock.calls[0])` | `expect(mockFn).toHaveBeenNthCalledWith(1, ...)` |
| `expect.objectContaining({ ... })` | 使用完整的对象字面量 |
| `expect.anything()` | 使用具体的预期值 |

### Mock 定义模板

```typescript
const mockService = {
  // 简单方法
  method: jest.fn(),
  
  // 返回 Promise 的方法
  asyncMethod: jest.fn().mockResolvedValue(mockData),
  
  // 抛出错误的方法
  errorMethod: jest.fn().mockRejectedValue(new Error('message')),
};
```

### 测试文件模板

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MyService } from './my.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

const mockPrismaService = {
  myModel: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('MyService', () => {
  let service: MyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something', async () => {
      // Arrange
      mockPrismaService.myModel.findUnique.mockResolvedValue(mockData);

      // Act
      const result = await service.methodName(id);

      // Assert
      expect(mockPrismaService.myModel.findUnique).toHaveBeenCalledWith({
        where: { id },
      });
      expect(result).toEqual(mockData);
    });
  });
});
```

## 📋 ESLint 自检清单

**每次生成代码后，按以下清单逐项检查：**

### 导入检查
- [ ] 所有 import 都在代码中实际使用
- [ ] 没有导入但未使用的模块
- [ ] 没有导入但未使用的类型/接口
- [ ] 导入顺序：外部模块 → 内部模块 → 相对路径

### 类型检查
- [ ] 所有函数参数有明确类型
- [ ] 所有函数返回值有明确类型（或 void）
- [ ] 没有滥用 `any` 类型
- [ ] 没有不必要的 `as` 类型断言
- [ ] 使用了 `interface` 或 `type` 定义数据结构

### 可空值处理
- [ ] 使用可选链 `?.` 访问可能为空的属性
- [ ] 使用 nullish coalescing `??` 提供默认值
- [ ] 对可能为 null/undefined 的返回值做了检查
- [ ] Map.get()、Array.find() 等返回值做了空值判断

### Promise 处理
- [ ] 所有异步操作使用 `await` 或 `.catch()`
- [ ] 没有 floating promises（被忽略的 Promise）
- [ ] `Promise.all` 中的 Promise 都正确处理
- [ ] 不需要等待结果的 Promise 使用 `void` 显式标记

### Prettier 格式
- [ ] 所有字符串使用单引号 `'`
- [ ] 多行对象/数组有尾随逗号
- [ ] 使用 2 空格缩进
- [ ] 没有超过 100 字符的行
- [ ] 没有连续 2 个以上空行
- [ ] 箭头函数格式正确

### 代码结构
- [ ] 文件结构顺序：导入 → 类型 → Mock → 逻辑
- [ ] 没有未使用的变量
- [ ] 没有 `eslint-disable` 注释
- [ ] 没有 `@ts-ignore` 或 `@ts-expect-error`

## 🚫 红线规则 (绝不允许)

- `/* eslint-disable */` 或 `// eslint-disable-next-line`
- `@ts-ignore` 或 `@ts-expect-error`
- 未使用的 import (写完就删掉不用的)
- 声明但从未使用的变量

## 验证命令

```bash
pnpm run lint && pnpm run typecheck && pnpm test
```
