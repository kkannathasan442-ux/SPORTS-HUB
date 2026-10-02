import { test, expect } from '@playwright/test';

test.describe('STEP 9 — Reporting, Analytics & Business Intelligence Flow E2E Tests', () => {
  test('1. Owner Reports Dashboard protects route and redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/owner/reports');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
  });

  test('2. GET /api/reports/overview rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.get('/api/reports/overview');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('3. GET /api/reports/bookings rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.get('/api/reports/bookings');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('4. GET /api/reports/revenue rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.get('/api/reports/revenue');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('5. GET /api/reports/facilities rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.get('/api/reports/facilities');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('6. GET /api/reports/customers rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.get('/api/reports/customers');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('7. GET /api/reports/export rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.get('/api/reports/export');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});
