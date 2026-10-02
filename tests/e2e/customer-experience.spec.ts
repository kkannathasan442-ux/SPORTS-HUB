import { test, expect } from '@playwright/test';

test.describe('STEP 11 — Customer Account, Booking History & Experience E2E Tests', () => {
  test('1. Customer Account page protects route and redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/customer/account');
    await expect(page).toHaveURL(/.*login.*error=auth_required/);
  });

  test('2. Customer Dashboard page protects route and redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/customer');
    await expect(page).toHaveURL(/.*login.*error=auth_required/);
  });

  test('3. Customer Bookings page protects route and redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/customer/bookings');
    await expect(page).toHaveURL(/.*login.*error=auth_required/);
  });

  test('4. Customer Booking Receipt page protects route and redirects unauthenticated visitors to login', async ({ page }) => {
    await page.goto('/customer/bookings/00000000-0000-0000-0000-000000000001/receipt');
    await expect(page).toHaveURL(/.*login.*error=auth_required/);
  });

  test('5. GET /api/customer/profile rejects unauthenticated requests with 401', async ({ request }) => {
    const res = await request.get('/api/customer/profile');
    expect(res.status()).toBe(401);
  });

  test('6. PATCH /api/customer/profile rejects unauthenticated requests with 401', async ({ request }) => {
    const res = await request.patch('/api/customer/profile', {
      data: {
        full_name: 'Hacked Customer Name',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('7. GET /api/customer/statistics rejects unauthenticated requests with 401', async ({ request }) => {
    const res = await request.get('/api/customer/statistics');
    expect(res.status()).toBe(401);
  });

  test('8. GET /api/customer/bookings rejects unauthenticated requests with 401', async ({ request }) => {
    const res = await request.get('/api/customer/bookings');
    expect(res.status()).toBe(401);
  });
});
