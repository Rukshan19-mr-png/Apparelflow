import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';

async function main() {
  if (databaseUrl.startsWith('file:')) {
    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: databaseUrl });
    try {
      await client.execute('SELECT 1');
    } finally {
      client.close();
    }
    return;
  }

  const { Client } = await import('pg');
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
