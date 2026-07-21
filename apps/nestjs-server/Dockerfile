# syntax=docker/dockerfile:1.7
# 注意: 构建上下文必须是 monorepo 根目录 (docker build -f apps/nestjs-server/Dockerfile .)
# 因为后端依赖 @nebula/shared 等 workspace 包
#
# 使用 pnpm deploy 命令(官方推荐的 monorepo 容器化方式):
# 它会把后端包及其所有依赖(含 workspace 依赖)实际复制到部署目录,
# 而不是通过符号链接。这保证了运行时 node_modules 结构完整。

ARG NODE_VERSION=22-alpine

# ============================================================
# Stage 1: base — 安装 pnpm,复用层
# ============================================================
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ============================================================
# Stage 2: build — 安装全部依赖、生成 Prisma client、构建
# ============================================================
FROM base AS build
WORKDIR /app

# 先复制 workspace 清单文件,利用 Docker 层缓存加速依赖安装
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY apps/nestjs-server/package.json ./apps/nestjs-server/
COPY apps/web/package.json ./apps/web/

# 安装所有依赖(包含 devDependencies,用于构建)
RUN pnpm install --frozen-lockfile

# 复制源码
COPY packages ./packages
COPY apps/nestjs-server ./apps/nestjs-server

# 生成 Prisma client (Prisma 7 多文件 schema)
RUN pnpm --filter @nebula/nestjs-server exec prisma generate

# 构建后端及其 workspace 依赖(@nebula/shared)
RUN pnpm --filter @nebula/nestjs-server... build

# 部署后端到独立目录(自动剔除 devDependencies,workspace 依赖被实际复制)
# 这是 pnpm 官方推荐的 monorepo 容器化方式
RUN pnpm deploy --filter=@nebula/nestjs-server --prod /app/deployed

# deploy 不会复制 dist(被 .gitignore 排除)和 prisma 目录,需要手动补充
# 用 cp 而非 COPY,因为这是在 build stage 内部操作已构建的文件
RUN cp -r /app/apps/nestjs-server/prisma /app/deployed/prisma && \
    cp /app/apps/nestjs-server/prisma.config.ts /app/deployed/ && \
    cp -r /app/apps/nestjs-server/dist /app/deployed/dist

# 复制 Prisma client 到部署目录
# 前面 prisma generate 已在源码目录生成 client(deploy --prod 剔除了 prisma CLI 无法重新生成)
# pnpm 结构下 .prisma 可能位于包本地或 hoisted 到根,两个位置都尝试
RUN mkdir -p /app/deployed/node_modules/.prisma && \
    (cp -r /app/apps/nestjs-server/node_modules/.prisma/. /app/deployed/node_modules/.prisma/ 2>/dev/null || \
     cp -r /app/node_modules/.prisma/. /app/deployed/node_modules/.prisma/ 2>/dev/null || true)

# ============================================================
# Stage 3: runtime — 最小运行时镜像
# ============================================================
FROM base AS runtime
WORKDIR /app

ENV NODE_ENV=production
# CloudRun 要求: 容器必须监听平台注入的 PORT 环境变量
# 应用已通过 process.env.PORT 读取端口(见 config-loader.ts),此处仅声明默认值
ENV PORT=3000
# CloudRun 要求: 无状态,文件上传目录使用 /tmp (容器可写层,实例销毁后丢失)
# 持久化文件请使用 CloudBase 云存储
ENV FILE_UPLOAD_DIR=/tmp/uploads

# 直接复制部署目录,它已经包含完整的 prod 依赖和构建产物
COPY --from=build /app/deployed ./

# 创建临时上传目录
RUN mkdir -p /tmp/uploads

EXPOSE 3000

# 健康检查 (/api/ping 是无需鉴权的轻量探针端点)
# 注意: CloudRun 会忽略 Dockerfile HEALTHCHECK 指令,通过平台层 HTTP 探针判断
# 此处保留供本地 docker run 和传统容器编排使用
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
