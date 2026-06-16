import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { configure, ArtifactArchiver } from '@serenity-js/core';
import { SerenityBDDReporter } from '@serenity-js/serenity-bdd';
import { BrowseTheWebWithPlaywright } from '@serenity-js/playwright';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// ⏱️ Aumentado a 60s para CI/Jenkins
setDefaultTimeout(60000);

let browser: Browser;
let context: BrowserContext;
let page: Page;

BeforeAll(async function () {
  // 🚀 Opciones esenciales para correr en Jenkins/CI sin interfaz gráfica
  browser = await chromium.launch({
    headless: true,
    timeout: 60000,
    args: [
      '--no-sandbox',              // Necesario en CI (Jenkins)
      '--disable-dev-shm-usage',   // Evita crashes por memoria compartida limitada
      '--disable-gpu',             // Sin GPU en entornos CI
      '--disable-extensions',      // Más liviano
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
    actors: {
      prepare(actor) {
        return actor.whoCan(
          BrowseTheWebWithPlaywright.using(browser)
        );
      },
    },
  });
});

Before(async function () {
  // 🧹 Contexto limpio por cada escenario (aislamiento entre pruebas)
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,  // Útil si tu app usa HTTPS con cert autofirmado
  });
  page = await context.newPage();
});

After(async function () {
  // 🔒 Cierra el contexto al terminar cada escenario
  if (context) {
    await context.close();
  }
});

AfterAll(async function () {
  // 🛑 Cierra el browser al terminar todas las pruebas
  if (browser) {
    await browser.close();
  }
});