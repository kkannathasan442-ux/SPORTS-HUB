import { test, expect } from '@playwright/test';

test.describe('STEP 7 — Payment & Transaction Management E2E Tests', () => {
  test('1. Customer Payment History page protects route and redirects unauthenticated visitors', async ({ page }) => {
    await page.goto('/customer/payments');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
  });

  test('2. Owner Financials & Payments Ledger protects route and redirects unauthenticated visitors', async ({ page }) => {
    await page.goto('/owner/payments');
    await expect(page).toHaveURL(/\/login/);
  });

  test('3. POST /api/payments/create rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.post('/api/payments/create', {
      data: {
        bookingId: '550e8400-e29b-41d4-a716-446655440000',
        paymentMethod: 'CARD',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  test('4. POST /api/payments/verify rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.post('/api/payments/verify', {
      data: {
        paymentTransactionId: '550e8400-e29b-41d4-a716-446655440000',
        verificationToken: 'tok_valid',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('5. POST /api/payments/refund rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.post('/api/payments/refund', {
      data: {
        paymentTransactionId: '550e8400-e29b-41d4-a716-446655440000',
        amount: 1000,
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('6. GET /api/customer/payments rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.get('/api/customer/payments');
    expect(response.status()).toBe(401);
  });

  test('7. GET /api/owner/payments rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.get('/api/owner/payments');
    expect(response.status()).toBe(401);
  });
});
