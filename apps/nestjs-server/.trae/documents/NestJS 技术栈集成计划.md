# NestJS 技术栈集成计划

## 目标
为 NestJS 项目集成完整的企业级技术栈，包括：
- ORM: Prisma（类型安全 + 自动迁移）
- API 风格: 纯 REST（Swagger/OpenAPI 自动生成）
- 认证: Passport-JWT + Refresh Token
- 校验: class-validator + class-transformer
- 配置: @nestjs/config (.env)

## 实施步骤

### 第一步：安装所有依赖包
```bash
pnpm add @nestjs/config class-validator class-transformer
pnpm add @nestjs/passport @nestjs/jwt passport passport-jwt passport-local bcrypt
pnpm add @nestjs/swagger swagger-ui-express
pnpm add prisma @prisma/client
pnpm add -D @types/passport-jwt @types/passport-local @types/b bcrypt
```

### 第二步：配置 Prisma ORM
1. 初始化 Prisma：`npx prisma init`
2. 配置 `.env` 添加 `DATABASE_URL`
3. 在 `prisma/schema.prisma` 中定义基础数据模型
4. 生成 Prisma Client：`npx prisma generate`
5. 创建 PrismaService（继承 PrismaClient 实现生命周期管理）
6. 创建 PrismaModule（全局注册）

### 第三步：配置 @nestjs/config
1. 创建 `src/config` 目录
2. 创建环境配置验证器（使用 class-validator）
3. 创建配置文件（database.config.ts, jwt.config.ts, app.config.ts）
4. 在 AppModule 中注册 ConfigModule（全局）

### 第四步：配置 Swagger/OpenAPI
1. 在 `main.ts` 中配置 Swagger 文档生成
2. 设置文档标题、版本、描述
3. 配置全局 API 前缀
4. 添加安全认证支持（JWT Bearer Token）

### 第五步：实现认证模块（Auth Module）
1. 创建 AuthModule、AuthService、AuthController
2. 创建 JWT Strategy 和 Local Strategy
3. 实现注册、登录、刷新 Token 接口
4. 创建 JWT 和 Refresh Token 配置
5. 实现 Token 黑名单/过期机制

### 第六步：实现用户模块（User Module）
1. 创建 UserModule、UserService、UserController
2. 使用 Prisma 定义 User 模型（id, email, password, name, createdAt, updatedAt）
3. 实现密码加密（bcrypt）
4. 创建 User Entity 和 DTO

### 第七步：创建通用模块和装饰器
1. 创建公共装饰器：`@Public()` - 跳过 JWT 认证
2. 创建 JWT 认证守卫（JwtAuthGuard）
3. 创建角色守卫（RolesGuard - 可选）
4. 创建全局异常过滤器
5. 创建全局 ValidationPipe 配置

### 第八步：配置 class-validator + class-transformer
1. 在 `main.ts` 中配置全局 ValidationPipe
2. 设置转换和验证选项
3. 创建基础 DTO 类

### 第九步：创建 Prisma 数据库迁移
1. 创建初始迁移文件
2. 运行迁移：`npx prisma migrate dev`

### 第十步：更新应用模块
1. 在 AppModule 中导入所有模块
2. 配置全局 Provider
3. 确保模块依赖关系正确

## 文件结构
```
src/
├── common/
│   ├── decorators/
│   │   └── public.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── pipes/
│       └── validation.pipe.ts
├── config/
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── app.config.ts
├── prisma/
│   └── prisma.service.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   └── dto/
│       ├── login.dto.ts
│       └── register.dto.ts
├── user/
│   ├── user.module.ts
│   ├── user.service.ts
│   ├── user.controller.ts
│   └── dto/
│       └── create-user.dto.ts
├── app.module.ts
├── app.controller.ts
├── app.service.ts
└── main.ts
```

## 环境变量配置（.env）
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/nestdb?schema=public"

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# App
PORT=3000
NODE_ENV=development
```

## 验证方式
1. 运行 `pnpm start:dev` 确保项目正常启动
2. 访问 Swagger 文档：`http://localhost:3000/api`
3. 测试用户注册和登录接口
4. 测试 JWT 认证保护的路由
5. 测试 Refresh Token 功能
6. 运行 `pnpm test` 确保测试通过
