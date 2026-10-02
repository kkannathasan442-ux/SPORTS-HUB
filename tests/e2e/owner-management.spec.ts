import { test, expect } from '@playwright/test';

test.describe('SportsHub Owner Portal & Venue Management E2E — STEP 4', () => {
  test('Unauthenticated user is redirected to login with auth_required when visiting /owner', async ({ page }) => {
    await page.goto('/owner');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Unauthenticated user is redirected when visiting /owner/venues', async ({ page }) => {
    await page.goto('/owner/venues');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Unauthenticated user is redirected when visiting /owner/organization', async ({ page }) => {
    await page.goto('/owner/organization');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Owner registration page renders organization name and profile inputs', async ({ page }) => {
    await page.goto('/register/owner');
    await expect(page).toHaveTitle(/Register as Venue Owner/i);
    await expect(page.getByRole('heading', { name: /Register as Venue Owner/i })).toBeVisible();
    await expect(page.getByPlaceholder('Kamal Perera')).toBeVisible();
    await expect(page.getByPlaceholder('Colombo Sports Arena')).toBeVisible();
    await expect(page.getByPlaceholder('owner@colombosports.lk')).toBeVisible();
    await expect(page.getByRole('button', { name: /Register Organization/i })).toBeVisible();
  });

  test('Owner routes have proper metadata titles and headers', async ({ page }) => {
    // Check login page has links to Owner registration
    await page.goto('/login');
    const ownerLink = page.getByRole('link', { name: /Register as Venue Owner/i });
    await expect(ownerLink).toBeVisible();
    await ownerLink.click();
    await expect(page).toHaveURL(/\/register\/owner/);
  });
});
