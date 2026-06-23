import { defineConfig } from '@playwright/test';
import { defineBddProject } from 'playwright-bdd';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  workers: 1,
  fullyParallel: false,
  use: { baseURL, trace: 'on-first-retry' },
  webServer: [
    {
      command: 'npx nx serve api',
      url: 'http://localhost:3000/api/health',
      timeout: 120_000,
      reuseExistingServer: true,
      cwd: workspaceRoot,
      env: {
        NODE_ENV: 'test',
        URL_PREVIEW: 'stub',
        JWT_SECRET: 'e2e-secret-32-characters-minimum!',
        DATABASE_URL: 'postgres://tracer:tracer@localhost:5433/tracer',
      },
    },
    {
      command: 'npx nx serve web',
      url: 'http://localhost:4200',
      timeout: 120_000,
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
  ],
  projects: [
    {
      ...defineBddProject({
        name: 'bdd',
        features: 'features/**/*.feature',
        steps: 'steps/**/*.ts',
      }),
      use: { baseURL },
    },
  ],
});
