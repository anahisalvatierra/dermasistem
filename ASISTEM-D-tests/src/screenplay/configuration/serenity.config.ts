import { configure } from '@serenity-js/core';
import { BrowseTheWebWithPlaywright } from '@serenity-js/playwright';
import { Browser, chromium } from 'playwright';

let browser: Browser;

export async function setupSerenity() {
  browser = await chromium.launch({ headless: true });
  const browserContext = await browser.newContext();
  const page = await browserContext.newPage();

  configure({
    crew: [
      BrowseTheWebWithPlaywright.using(chromium, {
        headless: true,
      }),
    ],
  });
}

export async function teardownSerenity() {
  if (browser) {
    await browser.close();
  }
}