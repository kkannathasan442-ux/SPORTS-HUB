import { test, expect } from '@playwright/test';

test.describe('SportsHub Web Foundation', () => {
  test('Landing page loads and displays brand elements', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SportsHub/i);
    await expect(page.getByRole('heading', { name: 'SportsHub' })).toBeVisible();
    await expect(page.getByText('Book. Play. Compete. Connect.').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Explore Sports/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Get Started/i }).first()).toBeVisible();
  });

  test('Health check route returns OK status', async ({ page }) => {
    await page.goto('/health');
    await expect(page.getByRole('heading', { name: 'SportsHub' })).toBeVisible();
    await expect(page.getByText('System Status: OK')).toBeVisible();
  });
});
