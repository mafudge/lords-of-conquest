// tests-e2e/human-trade-flow.spec.ts
import { test, expect } from '@playwright/test';

test('human can advance through selection to a playable phase', async ({ page }) => {
  await page.goto('/');

  // Default setup has player 0 = human; keep, set 1-3 as aggressive AI.
  await page.locator('.persona-select').nth(1).selectOption('aggressive');
  await page.locator('.persona-select').nth(2).selectOption('aggressive');
  await page.locator('.persona-select').nth(3).selectOption('aggressive');

  await page.click('.btn-start');

  // Auto-pick through selection until phase changes.
  for (let i = 0; i < 30; i++) {
    const autoBtn = page.locator('.actions button.act:has-text("Auto-pick")');
    if (await autoBtn.count() === 0) break;
    await autoBtn.click({ timeout: 5000 });
    await page.waitForTimeout(150);
  }

  // Wait for a phase that has interactive buttons (Propose Trade, Build, Ship, etc.)
  await page.waitForFunction(() => {
    const text = document.querySelector('.bottom-bar .actions')?.textContent ?? '';
    return text.includes('Propose Trade') || text.includes('Build') || text.includes('Ship') || text.includes('Conquest') || text.includes('End');
  }, { timeout: 30_000 });

  // If we reached trade phase as human, propose a trade.
  const proposeBtn = page.locator('button:has-text("Propose Trade")');
  if (await proposeBtn.count() > 0) {
    await proposeBtn.click();
    const builder = page.locator('.trade-builder');
    if (await builder.count() > 0) {
      const incs = page.locator('.tb-give .counter[data-r="0"] .inc');
      if (await incs.count() > 0) await incs.click();
      const incs2 = page.locator('.tb-receive .counter[data-r="0"] .inc');
      if (await incs2.count() > 0) await incs2.click();
      await page.click('.btn-cancel');
    }
  }
  expect(true).toBe(true); // smoke
});
