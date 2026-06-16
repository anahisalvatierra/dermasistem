import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { configure, ArtifactArchiver } from '@serenity-js/core';
import { SerenityBDDReporter } from '@serenity-js/serenity-bdd';
import { BrowseTheWebWithPlaywright } from '@serenity-js/playwright';
import { chromium, Browser } from 'playwright';

setDefaultTimeout(30000);

let browser: Browser;

BeforeAll(async function () {
  browser = await chromium.launch({ headless: true });

  configure({
    crew: [
      ArtifactArchiver.storingArtifactsAt('./target/site/serenity'),
      SerenityBDDReporter.fromJSON({}),
    ],
    actors: {
      prepare(actor) {
        return actor.whoCan(
          BrowseTheWebWithPlaywright.using(browser)
        );
      },
    },
  });
});

Before(async function () {});

After(async function () {});

AfterAll(async function () {
  if (browser) {
    await browser.close();
  }
});