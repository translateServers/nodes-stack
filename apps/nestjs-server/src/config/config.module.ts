import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadConfig } from './config-loader';
import { TypedConfigService } from './typed-config.service';

@Global() // 注册为全局模块，任何地方都可以直接注入
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
      // 忽略 .env 文件中的未定义变量，防止污染
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
  ],
  providers: [TypedConfigService],
  exports: [TypedConfigService],
})
export class AppConfigModule {}
