import { test, expect } from '@playwright/test';

test.describe('STEP 14 - Team Management E2E', () => {

  // Test users that would exist in the real database
  const customerEmail = 'customer1@test.sportshub.com';
  const customerPassword = 'password123';
  const customer2Email = 'customer2@test.sportshub.com';
  const customer2Password = 'password123';
  const teamName = 'E2E Test Team';

  test('Customer workflow: create team, invite player, accept, manage roles', async ({ page, context }) => {
    // A. Real customer authentication
    await page.goto('/login');
    await page.waitForTimeout(1000); // Wait for React hydration
    await page.waitForURL('**/login*', { timeout: 10000 }).catch(() => {});
    await page.waitForSelector('input[name="email"]', { timeout: 15000 });
    await page.fill('input[name="email"]', customerEmail);
    await page.fill('input[name="password"]', customerPassword);
    await page.click('button[type="submit"]');
    // Wait for redirect after successful login
    await page.waitForURL('**/customer*', { timeout: 5000 }).catch(() => {});
    const errorText = await page.locator('.text-rose-700').textContent().catch(() => null);
    if (errorText) console.log('Login Error:', errorText);
    await expect(page).not.toHaveURL(/.*login/);


    // B. Navigate to /customer/teams
    await page.goto('/customer/teams');

    // C. Create a real team
    await page.click('text=Create Team');
    await page.fill('input[name="teamName"]', teamName);
    await page.selectOption('select[name="sportId"]', { index: 1 }); // e.g., basketball
    await page.click('button[type="submit"]:has-text("Save")');

    // D. Verify the real team appears
    await expect(page.locator(`text=${teamName}`)).toBeVisible();

    // E. Open the real team detail page
    await page.click(`text=${teamName}`);
    await page.waitForSelector('text=Team Details');

    // F. Verify creator is CAPTAIN
    await expect(page.locator('text=CAPTAIN')).toBeVisible();

    // G. Send a real invitation
    await page.click('text=Invite Player');
    await page.fill('input[name="invitedEmail"]', customer2Email);
    await page.click('button[type="submit"]:has-text("Send Invite")');
    await expect(page.locator('text=Invitation sent')).toBeVisible();

    // H. Authenticate as second test customer
    const page2 = await context.newPage();
    await page2.goto('/login');
    await page2.waitForTimeout(1000); // Wait for React hydration
    await page2.fill('input[name="email"]', customer2Email);
    await page2.fill('input[name="password"]', customer2Password);
    await page2.click('button[type="submit"]');
    // Wait for redirect after successful login
    await page2.waitForURL('**/customer*', { timeout: 5000 }).catch(() => {});
    await expect(page2).not.toHaveURL(/.*login/);

    // I. Open real invitations page
    await page2.goto('/customer/teams');

    // J. Verify invitation appears
    await expect(page2.locator(`text=Invitation from ${teamName}`)).toBeVisible();

    // K. Accept invitation
    await page2.click('button:has-text("Accept")');
    await expect(page2.locator('text=Joined team successfully')).toBeVisible();

    // L. Verify real team membership becomes PLAYER
    await page2.click(`text=${teamName}`);
    await expect(page2.locator('text=PLAYER')).toBeVisible();

    // M. Authenticate as captain (back to page 1)
    await page.reload();

    // N. Promote player to MANAGER
    await page.click(`text=${customer2Email}`); // click on member row
    await page.selectOption('select[name="role"]', 'MANAGER');
    await page.click('button:has-text("Update Role")');

    // O. Verify real role
    await expect(page.locator(`text=${customer2Email} >> text=MANAGER`)).toBeVisible();

    // P. Authenticate as player/manager (page2)
    await page2.reload();

    // Q. Attempt a captain-only operation (e.g. updating the team name or deleting team)
    // Here we'll try to update someone else's role, which only Captain can do
    const editRoleButton = page2.locator('button:has-text("Edit Role")');
    await expect(editRoleButton).not.toBeVisible();

    // S. Authenticate as captain
    // T. Remove the member
    await page.click(`text=${customer2Email}`);
    await page.click('button:has-text("Remove Member")');
    await page.click('button:has-text("Confirm Remove")');

    // U. Verify membership is actually removed
    await expect(page.locator(`text=${customer2Email}`)).not.toBeVisible();
  });

  test('unauthenticated /customer/teams access', async ({ page }) => {
    // Should redirect to login
    await page.goto('/customer/teams');
    await page.waitForURL('**/login*');
    expect(page.url()).toContain('/login');
  });

  test('unauthorized API access', async ({ request }) => {
    const response = await request.post('/api/teams', {
      data: { name: 'Hacker Team', sportId: '00000000-0000-0000-0000-000000000000' }
    });
    expect(response.status()).toBe(401);
  });

  test('mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/customer/teams');
    await page.waitForURL('**/login*'); // defaults to auth redirect if no session
    expect(page.viewportSize()?.width).toBe(375);
  });
});
