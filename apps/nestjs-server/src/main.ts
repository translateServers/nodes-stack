import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from './app.module';
import { TypedConfigService } from '@/config/typed-config.service';
import { createLogger } from '@/modules/logger/logger.factory';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.enableShutdownHooks();

  const envConfig = app.get(TypedConfigService);
  const { port, apiPrefix, corsOrigin, enableSwagger } =
    envConfig.namespace('app');
  const logger = createLogger(envConfig);
  app.useLogger(logger);

  const origins = corsOrigin.split(',').map((s: string) => s.trim());
  app.enableCors({ origin: origins });

  app.setGlobalPrefix(apiPrefix);

  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('NestJS API')
      .setDescription('REST API 文档')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`/${apiPrefix}/docs`, app, cleanupOpenApiDoc(document));
  }

  await app.listen(port);

  logger.log(
    `Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  if (enableSwagger) {
    logger.log(
      `Swagger documentation is available at: http://localhost:${port}/${apiPrefix}/docs`,
      'Bootstrap',
    );
  }
}

void bootstrap();
