// tests-e2e/setup-and-self-play.spec.ts
import { test, expect } from '@playwright/test';

test('AI self-play reaches gameOver', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.setup-modal')).toBeVisible();

  // Set all players to aggressive AI
  const personaSelects = await page.locator('.persona-select').all();
  for (const sel of personaSelects) {
    await sel.selectOption('aggressive');
  }

  await page.click('.btn-start');

  // Press Space to enable fast-forward mode (keyboard.ts toggles setFastForward on Space).
  // runtime.ts uses setTimeout(0) so fast-forward doesn't starve the event loop.
  await page.keyboard.press('Space');

  // Wait for game-over banner (max 60s)
  await expect(page.locator('.game-over')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.game-over h1')).toContainText('wins');
});
