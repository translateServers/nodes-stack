# Swagger API文档、Controller类型定义、全局响应体重构计划

## 📋 现状分析

### 当前架构问题

1. **三份独立定义，结构不一致**
   - `src/common/types.ts` 定义了 TypeScript 接口（`ApiResponse`, `ApiErrorResponse`）
   - `src/common/dto/api-response.dto.ts` 定义了 Swagger DTO 类（`ApiResponseDto`, `ApiVoidResponseDto`）
   - `src/common/decorators/api-success-response.decorator.ts` 使用硬编码的 JSON Schema

2. **Controller 类型定义与实际响应不匹配**
   - Controller 方法返回类型如 `Promise<UserResponseDto>`
   - 实际经过 `TransformInterceptor` 后变成 `{ code: 200, data: UserResponseDto, message: 'Success', success: true }`
   - Swagger 文档需要手动维护，容易遗漏或错误

3. **装饰器设计缺陷**
   - `ApiSuccessResponse` 需要手动传入 DTO 类型，无法自动推断
   - `isVoid` 选项设计不合理，logout 接口传了 `TokenResponseDto` 但标记 `isVoid: true`
   - 缺少统一的错误响应装饰器

4. **缺少类型安全保障**
   - 修改响应格式需要同步更新多处
   - 没有编译时检查确保一致性

## 🎯 重构目标

1. **单一数据源** - 一个泛型 DTO 类同时服务 TypeScript 类型系统和 Swagger 文档
2. **自动类型推断** - 装饰器自动从方法返回类型推导响应格式
3. **统一错误处理** - 标准化的错误响应装饰器和文档
4. **编译时检查** - TypeScript 确保三者一致性

## 📐 新架构设计

### 核心组件关系

```
Controller 方法返回类型 (T)
         ↓
TransformInterceptor 包装
         ↓
ApiResponseDto<T> (泛型 DTO)
         ↓
Swagger 自动文档生成
```

### 数据结构统一

**成功响应格式：**
```typescript
{
  code: 200,           // HTTP 状态码
  message: 'Success',  // 响应消息
  success: true,       // 是否成功
  data: T              // 实际数据（泛型）
}
```

**错误响应格式：**
```typescript
{
  code: 400,           // 错误码
  message: '错误描述',  // 错误消息
  success: false,      // 是否成功
  details?: unknown    // 可选的详细错误信息
}
```

## 🔧 实施步骤

### 阶段一：统一响应类型定义（基础层）

#### 步骤 1.1：重构 `api-response.dto.ts`

**文件：** `src/common/dto/api-response.dto.ts`

**目标：** 创建泛型 DTO 类，同时满足 TypeScript 类型系统和 Swagger 文档需求

**关键变更：**
- 创建 `ApiResponseDto<T>` 泛型类，包含 `code`, `message`, `success`, `data` 四个字段
- `data` 字段使用泛型类型 `T`，支持任意数据类型
- 使用 `@ApiProperty` 装饰器自动生成 Swagger 文档
- 创建 `ApiErrorResponseDto` 统一错误响应格式
- 移除旧的 `ApiResponseDto` 和 `ApiVoidResponseDto`（非泛型版本）

**设计要点：**
- 泛型参数 `T` 默认为 `void`，处理无数据返回的接口
- 使用 TypeScript 条件类型处理 `void` 特殊情况
- 保持与现有 `TransformInterceptor` 兼容

#### 步骤 1.2：清理 `types.ts` 重复定义

**文件：** `src/common/types.ts`

**目标：** 移除重复的 `ApiResponse` 和 `ApiErrorResponse` 接口，统一使用 DTO 类

**关键变更：**
- 删除 `ApiResponse` 接口（已被 `ApiResponseDto<T>` 替代）
- 删除 `ApiErrorResponse` 接口（已被 `ApiErrorResponseDto` 替代）
- 保留 `UserPayload` 接口（认证相关，不属于响应体范畴）

**影响文件：**
- `src/common/interceptors/transform.interceptor.ts`
- `src/common/filters/http-exception.filter.ts`

### 阶段二：重构装饰器系统（自动化层）

#### 步骤 2.1：重构 `api-success-response.decorator.ts`

**文件：** `src/common/decorators/api-success-response.decorator.ts`

**目标：** 实现自动类型推断，消除手动指定

**关键变更：**
- 重构 `ApiSuccessResponse<T>` 装饰器，从泛型参数自动构建 Swagger Schema
- 移除 `isVoid` 选项，改为检测 `T` 是否为 `void` 类型
- 使用 `getSchemaPath` 自动生成 DTO 引用
- 创建 `buildSuccessSchema` 辅助函数处理数组和对象类型
- 保持 `ApiSuccessArrayResponse<T>` 用于数组返回类型

**技术实现：**
```typescript
// 自动检测 void 类型
function isVoidType(type: Type<any>): boolean {
  return type === Void || type.name === 'Void';
}

// 自动构建 Schema
function buildSuccessSchema<T>(
  type: Type<T>,
  isArray: boolean = false
): Record<string, unknown> {
  // 根据泛型类型自动生成正确的 Swagger Schema
}
```

#### 步骤 2.2：创建 `api-error-response.decorator.ts`

**文件：** `src/common/decorators/api-error-response.decorator.ts` (新建)

**目标：** 统一错误响应文档装饰器

**关键功能：**
- `@ApiErrorResponse(options)` - 通用错误响应装饰器
- 支持自定义错误码、错误描述
- 预设常见错误状态码（400, 401, 403, 404, 409, 500）
- 自动生成标准化的错误响应 Schema

**使用示例：**
```typescript
@ApiErrorResponse({ status: 400, description: '请求参数验证失败' })
@ApiErrorResponse({ status: 404, description: '资源不存在' })
```

### 阶段三：更新基础设施组件（集成层）

#### 步骤 3.1：更新 `TransformInterceptor`

**文件：** `src/common/interceptors/transform.interceptor.ts`

**目标：** 使用统一的类型定义

**关键变更：**
- 导入 `ApiResponseDto` 替代本地类型
- 确保拦截器返回类型与 DTO 定义一致
- 保持现有功能不变（包装响应为 `{ code, data, message, success }` 格式）

#### 步骤 3.2：更新 `HttpExceptionFilter`

**文件：** `src/common/filters/http-exception.filter.ts`

**目标：** 使用统一的错误响应类型

**关键变更：**
- 导入 `ApiErrorResponseDto` 替代本地类型
- 确保错误响应格式与 DTO 定义一致
- 保持现有错误处理逻辑不变

### 阶段四：更新所有 Controller（应用层）

#### 步骤 4.1：更新认证模块

**文件：** `src/modules/auth/auth.controller.ts`

**关键变更：**
- 移除 `ApiSuccessResponse as ApiVoidSuccessResponse` 的别名导入
- 更新 `logout` 方法装饰器，使用 `ApiSuccessResponse<void>`
- 简化错误响应装饰器使用新的 `@ApiErrorResponse`

**变更示例：**
```typescript
// 旧代码
@ApiVoidSuccessResponse(TokenResponseDto, { isVoid: true })

// 新代码
@ApiSuccessResponse<void>({ description: '退出登录成功' })
```

#### 步骤 4.2：更新用户模块

**文件：** `src/modules/user/user.controller.ts`

**关键变更：**
- 简化装饰器使用
- 确保所有接口都有完整的 Swagger 文档

#### 步骤 4.3：更新菜单模块

**文件：** `src/modules/menu/menu.controller.ts`

**关键变更：**
- 统一装饰器风格
- 确保树形结构响应正确文档化

#### 步骤 4.4：更新角色模块

**文件：** `src/modules/role/role.controller.ts`

**关键变更：**
- 移除内部的 `AssignMenusDto` 类定义，移到 `dto/` 目录
- 简化装饰器使用

### 阶段五：测试与验证

#### 步骤 5.1：运行类型检查

**命令：**
```bash
pnpm run typecheck
```

**目标：** 确保所有类型定义正确，无编译错误

#### 步骤 5.2：运行 ESLint 检查

**命令：**
```bash
pnpm run lint
```

**目标：** 确保代码符合项目规范

#### 步骤 5.3：运行单元测试

**命令：**
```bash
pnpm run test
```

**目标：** 确保现有测试通过，特别是：
- `transform.interceptor.spec.ts`
- `http-exception.filter.spec.ts`

#### 步骤 5.4：验证 Swagger 文档

**方法：**
1. 启动开发服务器：`pnpm run start:dev`
2. 访问 `http://localhost:3000/api/docs`
3. 检查所有接口文档是否正确生成
4. 验证响应 Schema 是否正确包含 `code`, `message`, `success`, `data` 字段

## 📊 预期成果

### 重构前 vs 重构后对比

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| 类型定义位置 | 2处（types.ts + dto） | 1处（dto） |
| 装饰器类型推断 | 手动指定 | 自动推断 |
| 错误响应文档 | 手动编写 Schema | 统一装饰器 |
| 类型安全保障 | 弱（易遗漏） | 强（编译时检查） |
| 维护成本 | 高（同步多处） | 低（单一数据源） |

### 代码量变化

- **删除：** 约 30 行重复类型定义
- **新增：** 约 50 行装饰器和 DTO 增强代码
- **修改：** 约 100 行 Controller 装饰器简化

## ⚠️ 风险与注意事项

1. **向后兼容性**
   - API 响应格式保持不变，不影响前端调用
   - 仅影响 Swagger 文档和 TypeScript 类型

2. **泛型类型推断限制**
   - TypeScript 装饰器无法直接获取方法返回类型
   - 仍需显式指定泛型参数，但通过类型约束减少错误

3. **Swagger 循环依赖**
   - 避免在 DTO 中引用自身（如树形结构）
   - 使用 `@ApiProperty({ type: [() => SelfDto] })` 解决

4. **测试覆盖**
   - 确保所有现有测试通过
   - 可能需要更新 mock 数据类型

## 📅 实施顺序

1. ✅ 阶段一：统一响应类型定义（基础）
2. ✅ 阶段二：重构装饰器系统（自动化）
3. ✅ 阶段三：更新基础设施组件（集成）
4. ✅ 阶段四：更新所有 Controller（应用）
5. ✅ 阶段五：测试与验证（质量保障）

每个阶段完成后运行对应的验证命令，确保不引入回归问题。
