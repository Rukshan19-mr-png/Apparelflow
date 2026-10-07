import 'dotenv/config';
import { createClient } from '@libsql/client';

const client = createClient({ url: process.env.DATABASE_URL || 'file:./dev.db' });

async function main() {
  try {
    await client.execute('SELECT 1');
  } finally {
    client.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
