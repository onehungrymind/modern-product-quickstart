// R02 — Config: 12-factor, env-only. No literal config; validated env; boots from env alone.
import { execFileSync } from 'node:child_process';
import { Probe, root, read, exists } from './_lib.mjs';

const p = new Probe();

p.assert(exists('apps/api/src/config/env.schema.ts'), 'env schema exists (apps/api/src/config/env.schema.ts)');

if (exists('apps/api/src/config/env.schema.ts')) {
  const schema = read('apps/api/src/config/env.schema.ts');
  p.assert(/validateEnv/.test(schema), 'env schema exports validateEnv');
  p.assert(/DATABASE_URL/.test(schema) && /JWT_SECRET/.test(schema), 'env schema declares DATABASE_URL + JWT_SECRET');
}

const appModule = exists('apps/api/src/app/app.module.ts') ? read('apps/api/src/app/app.module.ts') : '';
p.assert(
  /validate\s*:/.test(appModule) && /validateEnv\s*\(/.test(appModule),
  'ConfigModule wires validate via validateEnv (boot fails on bad env)',
);

// No literal connection strings anywhere in the api source — the URL must come from env.
let literals = '';
try {
  literals = execFileSync('grep', ['-rIl', '--include=*.ts', 'postgres://', 'apps/api/src'], {
    cwd: root,
    encoding: 'utf-8',
  }).trim();
} catch {
  literals = ''; // grep exit 1 = no matches
}
p.assert(literals === '', 'no literal connection string in apps/api/src', literals);

p.done();
