import { ConfigFactory } from '@nestjs/config/dist/interfaces';
import { treeifyError } from 'zod';
import { RootConfigSchema } from './schemas/root.schema';

export const loadConfig: ConfigFactory = () => {
  // 1. 将扁平的 process.env 映射为分层的 Namespace 结构
  const rawConfig = {
    app: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      apiPrefix: process.env.API_PREFIX,
      corsOrigin: process.env.CORS_ORIGIN,
      enableSwagger: process.env.ENABLE_SWAGGER,
    },
    database: {
      provider: process.env.DATABASE_PROVIDER,
      url: process.env.DATABASE_URL,
      maxConnections: process.env.DB_MAX_CONNECTIONS,
      logging: process.env.DB_LOGGING,
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      accessTokenTtl: process.env.JWT_ACCESS_TTL,
      refreshTokenTtl: process.env.JWT_REFRESH_TTL,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
    },
    logger: {
      loggerDir: process.env.LOGGER_DIR,
      loggerLevel: process.env.LOGGER_LEVEL,
      loggerEnableFile: process.env.LOGGER_ENABLE_FILE,
      loggerMaxFiles: process.env.LOGGER_MAX_FILES,
      loggerMaxSize: process.env.LOGGER_MAX_SIZE,
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB,
      keyPrefix: process.env.REDIS_KEY_PREFIX,
      connectTimeout: process.env.REDIS_CONNECT_TIMEOUT,
      maxRetries: process.env.REDIS_MAX_RETRIES,
      lazyConnect: process.env.REDIS_LAZY_CONNECT,
    },
  };

  // 2. 使用 Zod 进行严格的运行时校验和转换 (如 string -> number)
  const parsed = RootConfigSchema.safeParse(rawConfig);

  if (!parsed.success) {
    // 3. 校验失败：打印详细的错误信息并阻断启动
    console.error('❌ Environment variables validation failed:');
    const formattedErrors = treeifyError(parsed.error);
    const { errors } = formattedErrors;
    console.error(errors);
    throw new Error('Invalid environment variables. Server stopped.');
  }

  // 4. 校验成功：返回带有 'root' 键的对象，供 TypedConfigService 读取
  return {
    root: parsed.data,
  };
};
