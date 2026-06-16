import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { actorCalled, configure } from '@serenity-js/core';
import { BrowseTheWebWithPlaywright } from '@serenity-js/playwright';
import { chromium, Browser } from 'playwright';

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
  // No llamar dismiss() para no cerrar el browser
});

AfterAll(async function () {
  if (browser) {
    await browser.close();
  }
});