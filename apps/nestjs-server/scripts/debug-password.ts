/**
 * 调试工具：根据用户名或邮箱查询用户密码哈希，并尝试用候选密码匹配。
 *
 * 用法：
 *   pnpm debug:password <用户名或邮箱> [候选密码...]
 *
 * 示例：
 *   pnpm debug:password admin             # 使用内置候选密码列表
 *   pnpm debug:password admin admin123    # 指定候选密码
 *   pnpm debug:password admin@example.com myPassword123
 *
 * ⚠️  仅用于本地调试，禁止在生产环境使用。
 */
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcryptjs';

// ---------- 内置常见候选密码列表（可按需扩展）----------
const DEFAULT_CANDIDATES: string[] = [
  'admin123',
  'password',
  '123456',
  '12345678',
  'admin',
  'root',
  'test',
  'test123',
  'qwerty',
  'abc123',
  'P@ssw0rd',
  'P@ssword1',
  'Password1',
  'changeme',
  'welcome',
  'letmein',
  'monkey',
  'dragon',
  'master',
  'login',
];

// ---------- 主逻辑 ----------
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('用法: pnpm debug:password <用户名或邮箱> [候选密码...]');
    process.exit(1);
  }

  const account = args[0];
  const candidates = args.length > 1 ? args.slice(1) : DEFAULT_CANDIDATES;

  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./dev.db',
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: account }, { username: account }],
      },
    });

    if (!user) {
      console.error(`❌ 未找到用户: ${account}`);
      process.exit(1);
    }

    console.log('');
    console.log('========== 用户信息 ==========');
    console.log(`  ID:       ${user.id}`);
    console.log(`  用户名:   ${user.username}`);
    console.log(`  邮箱:     ${user.email}`);
    console.log(`  昵称:     ${user.name ?? '-'}`);
    console.log(`  状态:     ${user.isActive ? '激活' : '禁用'}`);
    console.log('');
    console.log('========== 密码哈希 ==========');
    console.log(`  ${user.password}`);
    console.log('');
    console.log('========== 密码匹配 ==========');
    console.log(`  候选密码数: ${candidates.length}`);
    console.log('');

    let matched: string | null = null;

    for (const candidate of candidates) {
      const isMatch = await bcrypt.compare(candidate, user.password);
      if (isMatch) {
        matched = candidate;
        console.log(`  ✅ 匹配成功!  密码 = "${candidate}"`);
        break;
      }
    }

    if (!matched) {
      console.log('  ❌ 所有候选密码均未匹配。');
      console.log('');
      console.log('  提示：你可以手动指定候选密码:');
      console.log(`    pnpm debug:password ${account} <你的密码猜测>`);
    }

    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
