import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { TypedConfigService } from '../src/config/typed-config.service';
import { parseExpiresIn } from '../src/common/utils/time.util';
import dayjs from 'dayjs';

/**
 * 调试脚本：根据用户邮箱生成 token
 *
 * 使用方式:
 *   pnpm run debug:token admin@example.com
 */
async function generateDebugToken() {
  const email = process.argv[2];

  if (!email) {
    console.error('用法: pnpm run debug:token <用户邮箱>');
    console.error('示例: pnpm run debug:token admin@example.com');
    process.exit(1);
  }

  console.log(`\n🔍 正在为邮箱 "${email}" 生成调试 token...\n`);

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const prisma = app.get(PrismaService);
    const jwtService = app.get(JwtService);
    const config = app.get(TypedConfigService);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.error(`\n❌ 用户不存在: ${email}`);
      process.exit(1);
    }

    if (!user.isActive) {
      console.error(`\n❌ 用户已停用: ${email}`);
      process.exit(1);
    }

    const jwtSecret = config.get('jwt.secret');
    const jwtRefreshSecret = config.get('jwt.refreshSecret');
    const jwtExpiresIn = config.get('jwt.accessTokenTtl');
    const jwtRefreshExpiresIn = config.get('jwt.refreshTokenTtl');

    const [accessToken, refreshToken] = await Promise.all([
      jwtService.signAsync(
        { sub: user.id },
        { secret: jwtSecret, expiresIn: jwtExpiresIn as unknown as number },
      ),
      jwtService.signAsync(
        { sub: user.id },
        { secret: jwtRefreshSecret, expiresIn: jwtRefreshExpiresIn as unknown as number },
      ),
    ]);

    const expiresInSeconds = parseExpiresIn(jwtRefreshExpiresIn);
    const expiresAt = dayjs().add(expiresInSeconds, 'second').toISOString();

    console.log('\n✅ Token 生成成功!\n');
    console.log('─'.repeat(60));
    console.log('Access Token:');
    console.log(accessToken);
    console.log('─'.repeat(60));
    console.log('\nRefresh Token:');
    console.log(refreshToken);
    console.log('─'.repeat(60));
    console.log(`\n过期时间: ${expiresAt}`);

    await app.close();
  } catch (error) {
    console.error('\n❌ Token 生成失败:');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

void generateDebugToken();
