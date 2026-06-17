import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { configure, ArtifactArchiver, Cast } from '@serenity-js/core';
import { SerenityBDDReporter } from '@serenity-js/serenity-bdd';
import { BrowseTheWebWithPlaywright } from '@serenity-js/playwright';
import { chromium, Browser, BrowserContext } from 'playwright';

setDefaultTimeout(60000);

let browser: Browser;
let context: BrowserContext;

BeforeAll(async function () {
  browser = await chromium.launch({
    headless: true,
    timeout: 60000,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });

  configure({
    crew: [
      ArtifactArchiver.storingArtifactsAt('./target/site/serenity'),
      SerenityBDDReporter.fromJSON({}),
    ],
    actors: Cast.where(actor =>
      actor.whoCan(
        BrowseTheWebWithPlaywright.using(browser)
      )
    ),
  });
});

Before(async function () {
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });
});

After(async function () {
  if (context) {
    await context.close();
  }
});

AfterAll(async function () {
  if (browser) {
    await browser.close();
  }
});