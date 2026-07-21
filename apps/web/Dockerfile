# syntax=docker/dockerfile:1.7
# 注意: 构建上下文必须是 monorepo 根目录 (docker build -f apps/web/Dockerfile .)
# 因为前端依赖 @nebula/shared 等 workspace 包
#
# 兼容两种部署环境:
#   1. 传统容器编排 (docker-compose): BACKEND_URL=http://server:3000
#   2. CloudBase CloudRun: BACKEND_URL 通过环境变量注入后端公网/内网地址

ARG NODE_VERSION=22-alpine
ARG NGINX_VERSION=alpine

# ============================================================
# Stage 1: base — 安装 pnpm,复用层
# ============================================================
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ============================================================
# Stage 2: build — 安装依赖并构建前端
# ============================================================
FROM base AS build
WORKDIR /app

# 先复制 workspace 清单文件,利用 Docker 层缓存加速依赖安装
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY apps/web/package.json ./apps/web/
COPY apps/nestjs-server/package.json ./apps/nestjs-server/

# 安装所有依赖(包含 devDependencies,用于构建)
RUN pnpm install --frozen-lockfile

# 复制源码(前端 + workspace 依赖包)
COPY packages ./packages
COPY apps/web ./apps/web

# 构建前端及其 workspace 依赖(@nebula/shared)
RUN pnpm --filter @nebula/web... build

# ============================================================
# Stage 3: runtime — nginx 服务静态文件
# ============================================================
FROM nginx:${NGINX_VERSION} AS runtime

# nginx 模板文件(含 ${BACKEND_URL} 占位符),由 entrypoint 渲染
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.template.conf

# 入口脚本: 用 envsubst 渲染 BACKEND_URL
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.d/40-render-backend-url.sh
RUN chmod +x /docker-entrypoint.d/40-render-backend-url.sh

# 复制 Vite 构建产物
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# 默认后端地址(docker-compose 场景),CloudRun 部署时会通过环境变量覆盖
ENV BACKEND_URL=http://server:3000

EXPOSE 80

# 健康检查: CloudRun 会忽略,本地/传统编排使用
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
