import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register, type AuthTokens } from './helpers/api-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DATA_DIR = path.join(__dirname, 'test-data');

const TEST_USERS = {
  admin: {
    email: 'e2e-admin@test.local',
    username: 'e2e_admin',
    password: 'Test@12345',
    name: 'E2E Admin',
  },
  viewer: {
    email: 'e2e-viewer@test.local',
    username: 'e2e_viewer',
    password: 'Test@12345',
    name: 'E2E Viewer',
  },
} as const;

export type TestRole = keyof typeof TEST_USERS;

async function registerTestUser(role: TestRole): Promise<AuthTokens> {
  const ts = Date.now();
  const user = TEST_USERS[role];
  return register({
    email: `e2e-${role}-${ts}@test.local`,
    username: `e2e_${role}_${ts}`,
    password: user.password,
    name: user.name,
  });
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  const apiBase = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
  await waitForServer(`${apiBase}/ping`);

  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }

  const roles: TestRole[] = ['admin', 'viewer'];

  await Promise.all(
    roles.map(async (role) => {
      const tokens = await registerTestUser(role);
      const filePath = path.join(TEST_DATA_DIR, `${role}-auth.json`);
      fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf-8');
      console.log(`[e2e] Registered test ${role} user, tokens saved to ${filePath}`);
    }),
  );
}
