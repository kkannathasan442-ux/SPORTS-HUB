import { test, expect } from '@playwright/test';

test.describe('SportsHub Customer Discovery & Venue Search — STEP 5', () => {
  test('Landing page renders discovery entry point and sports search bar', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SportsHub/i);
    await expect(page.getByRole('heading', { name: /Find a place to play/i })).toBeVisible();

    // Verify search bar controls
    await expect(page.getByPlaceholder(/City, town, or area/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Search Venues/i })).toBeVisible();

    // Verify sports catalog is present
    await expect(page.getByRole('heading', { name: /Explore Sports Disciplines/i })).toBeVisible();
  });

  test('Navigating to /search renders search bar, filters, and venue listings', async ({ page }) => {
    await page.goto('/search');
    await expect(page).toHaveTitle(/Discover Sports Venues/i);

    // Verify filter sidebar controls
    await expect(page.getByRole('heading', { name: /Search Filters/i })).toBeVisible();
    await expect(page.getByText('Sport Discipline', { exact: true })).toBeVisible();
    await expect(page.getByText('Distance Radius', { exact: true })).toBeVisible();
    await expect(page.getByText('Sort By', { exact: true })).toBeVisible();

    // Verify List and Map view toggle controls
    await expect(page.getByRole('button', { name: /List View/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Map View/i })).toBeVisible();
  });

  test('Map View toggle switches view mode without error', async ({ page }) => {
    await page.goto('/search?view=map');
    await expect(page.getByText(/Geographic Map Foundation/i)).toBeVisible();

    const listToggle = page.getByTestId('list-view-toggle');
    await expect(listToggle).toBeVisible();
    await listToggle.click();
    await expect(listToggle).toBeVisible();
  });

  test('Empty search query with no matching venues shows friendly empty state', async ({ page }) => {
    await page.goto('/search?locationText=NonExistentLocationXYZ123456');
    await expect(page.getByText(/No Venues Found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Clear All Filters/i })).toBeVisible();
  });

  test('Public venue detail route handles missing/anonymous requests gracefully', async ({ page }) => {
    await page.goto('/venues/sample-test-venue');
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText(/Venue Listing Not Found/i)).toBeVisible();
  });

  test('Customer bookings route redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/customer/bookings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Owner dashboard routes remain protected from unauthenticated access', async ({ page }) => {
    await page.goto('/owner');
    await expect(page).toHaveURL(/\/login/);
  });
});
