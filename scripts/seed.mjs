#!/usr/bin/env node
// Seed a demo user so you can log in immediately. (You can also click "Register" in
// the UI to make your own account.) Run after the schema exists:
//   npm run db:up && npm run migration:run && npm run seed
import pg from 'pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const DEMO = { email: 'demo@tracer.local', name: 'Demo User', password: 'tracerdemo123' };
const url = process.env.DATABASE_URL ?? 'postgres://tracer:tracer@localhost:5433/tracer';

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const passwordHash = await bcrypt.hash(DEMO.password, 10);
  await client.query(
    `INSERT INTO users (id, email, password_hash, name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name`,
    [randomUUID(), DEMO.email, passwordHash, DEMO.name],
  );
  console.log(`Seeded demo user:  ${DEMO.email}  /  ${DEMO.password}`);
} catch (err) {
  if (err.code === '42P01') {
    console.error(
      'The "users" table does not exist yet. Create the schema first:\n' +
        '  npm run db:up && npm run migration:run   (or boot the API once: npm run serve:api)\n' +
        'then re-run: npm run seed',
    );
    process.exit(1);
  }
  throw err;
} finally {
  await client.end();
}
