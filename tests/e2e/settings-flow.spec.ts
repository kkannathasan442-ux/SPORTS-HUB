import { test, expect } from '@playwright/test';

test.describe('STEP 10 — Platform Administration, Organization Settings & Audit System Flow E2E Tests', () => {
  test('1. Owner Settings page protects route and redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/owner/settings');
    await expect(page).toHaveURL(/.*login.*error=auth_required/);
  });

  test('2. Owner Members page protects route and redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/owner/members');
    await expect(page).toHaveURL(/.*login.*error=auth_required/);
  });

  test('3. Owner Audit Logs page protects route and redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/owner/audit-logs');
    await expect(page).toHaveURL(/.*login.*error=auth_required/);
  });

  test('4. GET /api/owner/settings rejects unauthenticated requests with 401', async ({ request }) => {
    const res = await request.get('/api/owner/settings');
    expect(res.status()).toBe(401);
  });

  test('5. PATCH /api/owner/settings rejects unauthenticated requests with 401', async ({ request }) => {
    const res = await request.patch('/api/owner/settings', {
      data: {
        name: 'Hacked Organization Name',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('6. GET /api/owner/members rejects unauthenticated requests with 401', async ({ request }) => {
    const res = await request.get('/api/owner/members');
    expect(res.status()).toBe(401);
  });

  test('7. POST /api/owner/members rejects unauthenticated requests with 401', async ({ request }) => {
    const res = await request.post('/api/owner/members', {
      data: {
        email: 'unauth@test.local',
        role: 'MANAGER',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('8. GET /api/owner/audit-logs rejects unauthenticated requests with 401', async ({ request }) => {
    const res = await request.get('/api/owner/audit-logs');
    expect(res.status()).toBe(401);
  });
});
