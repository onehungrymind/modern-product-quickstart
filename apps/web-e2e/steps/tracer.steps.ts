import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then, Before } = createBdd();

// ---------------------------------------------------------------------------
// Shared state per scenario (reset in Before hook)
// ---------------------------------------------------------------------------
let linkId: string | null = null;
let linkSlug: string | null = null;
let authCookie: string | null = null;
let redirectResponse: { status: number; location: string | null } | null = null;

Before(async () => {
  linkId = null;
  linkSlug = null;
  authCookie = null;
  redirectResponse = null;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const API = 'http://localhost:3000';

async function resetDb(request: APIRequestContext): Promise<void> {
  const res = await request.post(`${API}/api/test/reset`);
  expect(res.ok(), `POST /api/test/reset failed: ${res.status()}`).toBeTruthy();
}

async function registerAndLogin(
  request: APIRequestContext,
  email: string,
  password: string,
  name: string,
): Promise<string> {
  const regRes = await request.post(`${API}/api/auth/register`, {
    data: { email, password, name },
  });
  expect(
    regRes.ok(),
    `register failed: ${regRes.status()} ${await regRes.text()}`,
  ).toBeTruthy();

  // Extract tracer_token cookie from set-cookie header
  const setCookie = regRes.headers()['set-cookie'] ?? '';
  const match = /tracer_token=[^;]+/.exec(setCookie);
  if (match) return match[0];

  // Fallback: explicit login
  const loginRes = await request.post(`${API}/api/auth/login`, {
    data: { email, password },
  });
  expect(loginRes.ok(), `login failed: ${loginRes.status()}`).toBeTruthy();
  const loginCookie = loginRes.headers()['set-cookie'] ?? '';
  const loginMatch = /tracer_token=[^;]+/.exec(loginCookie);
  if (!loginMatch) throw new Error('tracer_token cookie not found after login');
  return loginMatch[0];
}

async function apiCreateLink(
  request: APIRequestContext,
  cookie: string,
  targetUrl: string,
): Promise<{ id: string; slug: string }> {
  const res = await request.post(`${API}/api/links`, {
    data: { target_url: targetUrl },
    headers: { Cookie: cookie },
  });
  expect(
    res.ok(),
    `POST /api/links failed: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  const body = (await res.json()) as { id: string; slug: string };
  return { id: body.id, slug: body.slug };
}

async function loginViaUi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/links', { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------
Given('the test database is reset', async ({ request }) => {
  await resetDb(request);
});

// ---------------------------------------------------------------------------
// create-link.feature
// ---------------------------------------------------------------------------
Given('a user is registered and logged in', async ({ page, request }) => {
  const email = `e2e-create-${Date.now()}@tracer.test`;
  const password = 'e2ePassword1!';
  const name = 'E2E Create User';

  await registerAndLogin(request, email, password, name);
  await loginViaUi(page, email, password);
});

When(
  'they create a link for {string}',
  async ({ page }, targetUrl: string) => {
    await page
      .getByPlaceholder('https://example.com/long-url')
      .fill(targetUrl);
    await page.getByRole('button', { name: 'Shorten' }).click();

    // Wait for the list to appear
    await expect(
      page.getByRole('list', { name: 'Shortened links' }),
    ).toBeVisible({ timeout: 10_000 });
  },
);

Then('the link appears in their links list', async ({ page }) => {
  const list = page.getByRole('list', { name: 'Shortened links' });
  await expect(list).toBeVisible({ timeout: 10_000 });
  const count = await list.getByRole('listitem').count();
  expect(count, 'Expected at least one link in the list').toBeGreaterThanOrEqual(1);
});

Then('a short URL is shown for the link', async ({ page }) => {
  const list = page.getByRole('list', { name: 'Shortened links' });
  const firstItem = list.getByRole('listitem').first();
  const shortUrlText = await firstItem
    .locator('.links-list__short')
    .innerText();
  expect(shortUrlText.trim()).toMatch(/https?:\/\/localhost(:\d+)?\/\w+/);
});

// ---------------------------------------------------------------------------
// resolve-link.feature
// ---------------------------------------------------------------------------
Given(
  'a user has created a link for {string}',
  async ({ request }, targetUrl: string) => {
    const email = `e2e-resolve-${Date.now()}@tracer.test`;
    const password = 'e2ePassword1!';
    const cookie = await registerAndLogin(
      request,
      email,
      password,
      'Resolve User',
    );
    authCookie = cookie;

    const link = await apiCreateLink(request, cookie, targetUrl);
    linkId = link.id;
    linkSlug = link.slug;
  },
);

When('a visitor requests the short URL via the API', async ({ request }) => {
  if (!linkSlug) throw new Error('linkSlug must be set');
  const url = `${API}/${linkSlug}`;
  const res = await request.get(url, { maxRedirects: 0 });
  redirectResponse = {
    status: res.status(),
    location: res.headers()['location'] ?? null,
  };
});

Then(
  'they are redirected with status 302 to {string}',
  async ({}, expectedTarget: string) => {
    if (!redirectResponse) throw new Error('redirect response must be set');
    expect(redirectResponse.status).toBe(302);
    expect(redirectResponse.location).toBe(expectedTarget);
  },
);

Then('the link analytics show at least one click', async ({ request }) => {
  if (!linkId) throw new Error('linkId must be set');
  if (!authCookie) throw new Error('authCookie must be set');

  // Give the server a moment to record the async click
  await new Promise<void>((resolve) => setTimeout(resolve, 500));

  const res = await request.get(`${API}/api/links/${linkId}/clicks`, {
    headers: { Cookie: authCookie },
  });
  expect(
    res.ok(),
    `GET /api/links/:id/clicks failed: ${res.status()}`,
  ).toBeTruthy();

  const body = (await res.json()) as { total: number };
  expect(body.total, 'Expected at least one click').toBeGreaterThanOrEqual(1);
});
