import { Before, After } from '@cucumber/cucumber';
import { actorCalled, actorInTheSpotlight, configure } from '@serenity-js/core';
import { BrowseTheWebWithPlaywright } from '@serenity-js/playwright';
import { chromium, Browser } from 'playwright';

let browser: Browser;

Before(async function () {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }

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
    // ignorar si ya fue cerrado
  }
});