#!/bin/sh
# nginx 官方 entrypoint 的预渲染脚本
# 此脚本位于 /docker-entrypoint.d/,会被 nginx 官方 entrypoint 自动执行
# 用途: 用 envsubst 渲染 nginx.conf 中的 ${BACKEND_URL} 占位符
#
# BACKEND_URL 来源:
#   - 传统 docker-compose: 默认 http://server:3000 (Dockerfile ENV)
#   - CloudBase CloudRun: 部署时通过环境变量注入后端公网/内网地址
#   - 本地 docker run: 通过 -e BACKEND_URL=... 注入

set -e

# 如果 BACKEND_URL 未设置,使用默认值(docker-compose 服务名)
: "${BACKEND_URL:=http://server:3000}"

echo "[nginx-init] BACKEND_URL=${BACKEND_URL}"

# 渲染模板: 只替换 ${BACKEND_URL},保留其他 nginx 变量 ($host, $remote_addr 等)
# 通过 envsubst 的 SHELL_FORMAT 参数限定只替换指定变量
envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.template.conf > /etc/nginx/conf.d/default.conf

# 移除模板文件,避免被 nginx 加载
rm -f /etc/nginx/conf.d/default.template.conf

# 不启动 nginx,让 nginx 官方 entrypoint 继续执行 CMD
