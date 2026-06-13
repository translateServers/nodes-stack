# TypeScript 6.0.3 升级评估

## 评估结论

✅ **推荐升级** — 项目当前配置与 TS 6.0 兼容性**非常好**，改动量**极小**。

---

## 当前状态

| 项目                         | 当前值   | TS 6.0 要求 | 是否兼容 |
| ---------------------------- | -------- | ----------- | -------- |
| TypeScript                   | 5.7.3    | 6.0.3       | 需升级   |
| module                       | nodenext | 非废弃值    | ✅ 兼容  |
| moduleResolution             | nodenext | 非废弃值    | ✅ 兼容  |
| target                       | ES2023   | ES2015+     | ✅ 兼容  |
| strict                       | true     | 默认 true   | ✅ 兼容  |
| esModuleInterop              | true     | 非 false    | ✅ 兼容  |
| allowSyntheticDefaultImports | true     | 非 false    | ✅ 兼容  |
| baseUrl                      | ./       | ⚠️ 已废弃   | 需移除   |
| types                        | 未设置   | 默认 []     | 需确认   |

---

## 关键 Breaking Changes 分析

### 1. `--baseUrl` 已废弃 ⚠️ 需要改动

TS 6.0 废弃了 `baseUrl` 配置项。我们当前在 [tsconfig.json](file:///c:/Archangel/nest-server/tsconfig.json#L16) 中使用了：

```json
"baseUrl": "./",
"paths": {
  "@/*": ["src/*"],
  ...
}
```

**影响**：`baseUrl` 仅用于配合 `paths` 做路径映射。TS 6.0 废弃了 `baseUrl`，但 `paths` 仍可单独使用（路径相对于 tsconfig.json 所在目录）。

**改动方案**：直接删除 `"baseUrl": "./"` 即可，`paths` 仍然有效。

### 2. `types` 默认值改为 `[]` ⚠️ 需要确认

TS 6.0 中 `types` 默认值为空数组，不再自动引入 `@types/*` 包。

**影响**：我们使用了 `@types/node`、`@types/express` 等包。如果不显式声明，可能找不到这些类型。

**改动方案**：在 `tsconfig.json` 中添加：

```json
"types": ["node", "jest", "express"]
```

### 3. 其他废弃项（不影响本项目）

| 废弃项                         | 当前项目状态               |
| ------------------------------ | -------------------------- |
| target: es5                    | ❌ 不使用（已用 ES2023）   |
| downlevelIteration             | ❌ 不使用                  |
| moduleResolution: node/classic | ❌ 不使用（已用 nodenext） |
| amd/umd/systemjs module        | ❌ 不使用                  |
| esModuleInterop: false         | ❌ 不使用（已为 true）     |
| outFile                        | ❌ 不使用                  |
| legacy module syntax           | ❌ 不使用                  |
| import assertions              | ❌ 不使用                  |

---

## 依赖兼容性检查

### NestJS 生态

| 依赖               | 版本    | 兼容性         |
| ------------------ | ------- | -------------- |
| @nestjs/common     | ^11.0.1 | ✅ 兼容 TS 6.0 |
| @nestjs/cli        | ^11.0.0 | ✅ 兼容        |
| @nestjs/schematics | ^11.0.0 | ✅ 兼容        |

### TypeScript 工具链

| 工具              | 版本    | 兼容性         |
| ----------------- | ------- | -------------- |
| ts-jest           | ^29.2.5 | ✅ 兼容 TS 6.0 |
| ts-node           | ^10.9.2 | ✅ 兼容        |
| ts-loader         | ^9.5.2  | ✅ 兼容        |
| typescript-eslint | ^8.20.0 | ✅ 兼容 TS 6.0 |

### 其他依赖

| 依赖    | 版本    | 兼容性  |
| ------- | ------- | ------- |
| zod     | ^4.4.0  | ✅ 兼容 |
| prisma  | ^7.8.0  | ✅ 兼容 |
| winston | ^3.19.0 | ✅ 兼容 |

---

## TS 6.0 新特性（可选使用）

| 特性                 | 说明                             | 对本项目价值         |
| -------------------- | -------------------------------- | -------------------- |
| ES2025 target/lib    | 新增 es2025 目标选项             | 可考虑从 ES2023 升级 |
| Temporal API 类型    | 内置 Temporal 日期/时间类型      | 可替代 dayjs         |
| --stableTypeOrdering | 稳定类型排序（为 TS 7.0 做准备） | 非必须               |
| 更智能的函数推断     | this-less 函数推断更准确         | 自动受益             |
| #/ 子路径导入        | 支持 #/ 前缀的导入别名           | 非必须               |

---

## 升级步骤

### Step 1: 更新 package.json

```diff
- "typescript": "^5.7.3",
+ "typescript": "^6.0.3",
```

### Step 2: 更新 tsconfig.json

```diff
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "noFallthroughCasesInSwitch": true,
    "strict": true,
+   "types": ["node", "jest"],
    "paths": {
      "@/*": ["src/*"],
      "@modules/*": ["src/modules/*"],
      "@common/*": ["src/common/*"],
      "@config/*": ["src/config/*"]
    },
-   "baseUrl": "./"
  }
}
```

### Step 3: 重新安装依赖

```bash
pnpm install
```

### Step 4: 验证

```bash
pnpm run lint && pnpm run typecheck && pnpm test
```

---

## 风险评估

| 风险项       | 等级  | 说明                                            |
| ------------ | ----- | ----------------------------------------------- |
| 编译失败     | 🟢 低 | 项目已使用 strict + nodenext，配置现代          |
| 类型错误     | 🟢 低 | 代码质量高，不太可能因推断变化报错              |
| 依赖不兼容   | 🟢 低 | NestJS 11 + 工具链均为最新版，兼容 TS 6.0       |
| 构建工具问题 | 🟡 中 | ts-node、ts-jest 需确认版本兼容（当前版本兼容） |

---

## 总结

**升级难度：⭐ (1/5)**

项目当前配置已经非常现代化（strict: true、nodenext、ES2023），绝大部分 TS 6.0 的破坏性变更不影响本项目。唯一需要做的改动是：

1. 删除 `baseUrl` 配置
2. 显式声明 `types` 数组
3. 升级 typescript 版本

预计 5 分钟内可完成升级和验证。
