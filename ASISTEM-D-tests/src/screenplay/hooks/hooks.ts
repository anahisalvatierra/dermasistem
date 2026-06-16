import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { actorInTheSpotlight, configure } from '@serenity-js/core';
import { BrowseTheWebWithPlaywright } from '@serenity-js/playwright';
import { chromium, Browser } from 'playwright';

setDefaultTimeout(30000);

let browser: Browser;

BeforeAll(async function () {
  browser = await chromium.launch({ headless: true });
});

Before(async function () {
  configure({
    actors: {
      prepare(actor) {
        return actor.whoCan(
          BrowseTheWebWithPlaywright.using(browser)
        );
      },
    },
  });
});

After(async function () {
  // No cerrar browser entre scenarios
});

AfterAll(async function () {
  if (browser) {
    await browser.close();
  }
});