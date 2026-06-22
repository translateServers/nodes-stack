import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DATA_DIR = path.join(__dirname, 'test-data');

export default function globalTeardown(): void {
  if (fs.existsSync(TEST_DATA_DIR)) {
    const files = fs.readdirSync(TEST_DATA_DIR).filter((f: string) => f.endsWith('.json'));
    for (const file of files) {
      fs.unlinkSync(path.join(TEST_DATA_DIR, file));
    }
    console.log(`[e2e] Cleaned up ${files.length} auth token file(s)`);
  }
}
