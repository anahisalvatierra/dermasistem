import { Before, After } from '@cucumber/cucumber';
import { actorInTheSpotlight, configure } from '@serenity-js/core';
import { BrowseTheWebWithPlaywright } from '@serenity-js/playwright';
import { chromium } from 'playwright';

Before(async function () {
  const browser = await chromium.launch({ headless: true });

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
  await actorInTheSpotlight().dismiss();
});