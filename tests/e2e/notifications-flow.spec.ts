import { test, expect } from '@playwright/test';

test.describe('STEP 8 — Notifications & Communication Flow E2E Tests', () => {
  test('1. Customer Notification Center protects route and redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/customer/notifications');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
  });

  test('2. Owner Notifications Activity Ledger protects route and redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/owner/notifications');
    await expect(page).toHaveURL(/\/login/);
  });

  test('3. GET /api/notifications rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.get('/api/notifications');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  test('4. GET /api/notifications/unread-count rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.get('/api/notifications/unread-count');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('5. POST /api/notifications/notif-1/read rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.post('/api/notifications/notif-1/read');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('6. POST /api/notifications/read-all rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.post('/api/notifications/read-all');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('7. GET /api/notification-preferences rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.get('/api/notification-preferences');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('8. PATCH /api/notification-preferences rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.patch('/api/notification-preferences', {
      data: {
        email_booking_confirmations: false,
      },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('9. Public discovery and home pages remain responsive and operational', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SportsHub/);
    await expect(page.locator('text=Book. Play. Compete. Connect.').first()).toBeVisible();
  });
});
