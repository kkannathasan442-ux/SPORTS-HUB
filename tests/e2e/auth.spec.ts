import { test, expect } from '@playwright/test';

test.describe('SportsHub Authentication & Protected Routes — STEP 3', () => {
  test('Login page renders with required fields and navigation links', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Sign In/i);
    await expect(page.getByRole('heading', { name: /Sign in to SportsHub/i })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Create customer account/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Register as Venue Owner/i })).toBeVisible();
  });

  test('Customer registration page renders with all required customer fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveTitle(/Register Account/i);
    await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    await expect(page.getByPlaceholder('John Silva')).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('+94 77 123 4567')).toBeVisible();
    await expect(page.getByPlaceholder('Minimum 6 characters')).toBeVisible();
    await expect(page.getByPlaceholder('Repeat password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Register Account/i })).toBeVisible();
  });

  test('Owner registration page renders with organization name and operator fields', async ({ page }) => {
    await page.goto('/register/owner');
    await expect(page).toHaveTitle(/Register as Venue Owner/i);
    await expect(page.getByRole('heading', { name: /Register as Venue Owner/i })).toBeVisible();
    await expect(page.getByPlaceholder('Kamal Perera')).toBeVisible();
    await expect(page.getByPlaceholder('Colombo Sports Arena')).toBeVisible();
    await expect(page.getByPlaceholder('owner@colombosports.lk')).toBeVisible();
    await expect(page.getByRole('button', { name: /Register Organization/i })).toBeVisible();
  });

  test('Protected customer route redirects or prompts login when unauthenticated', async ({ page }) => {
    await page.goto('/customer');
    // Unauthenticated user should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('Protected admin route rejects unauthorized access without Super Admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/Platform Administrator Access Required/i)).toBeVisible();
  });
});
