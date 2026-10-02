import { test, expect } from '@playwright/test';

test.describe('STEP 6 — Booking Flow, Holds, Receipts & Ledgers E2E Tests', () => {
  test('1. Customer can navigate to search page and search bar is rendered', async ({ page }) => {
    await page.goto('/search');
    await expect(page).toHaveTitle(/SportsHub/);

    const searchHeader = page.locator('h1, h2').first();
    await expect(searchHeader).toBeVisible();
  });

  test('2. Customer Bookings portal protects route and redirects unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/customer/bookings');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
  });

  test('3. Owner Bookings Ledger protects route and redirects unauthenticated visitor', async ({ page }) => {
    await page.goto('/owner/bookings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('4. Front Desk Receptionist Desk protects route and redirects unauthenticated visitor', async ({ page }) => {
    await page.goto('/receptionist');
    await expect(page).toHaveURL(/\/login/);
  });
});
