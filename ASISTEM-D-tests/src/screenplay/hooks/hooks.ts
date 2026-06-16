import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { actorInTheSpotlight, configure } from '@serenity-js/core';
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
  try {
    await actorInTheSpotlight().dismiss();
  } catch (e) {
    // ignorar errores al cerrar
  }
});

AfterAll(async function () {
  if (browser) {
    await browser.close();
  }
});