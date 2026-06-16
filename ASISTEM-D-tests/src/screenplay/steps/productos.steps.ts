import { Given, When, Then } from '@cucumber/cucumber';
import { actorCalled } from '@serenity-js/core';
import { Navigate, PageElement, By, Click, Enter, Text } from '@serenity-js/web';
import { Ensure, includes } from '@serenity-js/assertions';
import { config } from '../configuration/environment';

Given('que el usuario está en la sección de productos', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(`${config.baseUrl}/productos`)
  );
});

When('navega a la sección de productos', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(`${config.baseUrl}/productos`)
  );
});

When('busca {string}', async (termino: string) => {
  await actorCalled('Usuario').attemptsTo(
    Enter.theValue(termino).into(
      PageElement.located(By.css('input[type="search"], input[placeholder*="buscar"], input[placeholder*="Buscar"]'))
        .describedAs('campo de búsqueda')
    )
  );
});

Then('debería ver al menos un producto listado', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('.producto, .product, [class*="product"], mat-card')).describedAs('producto')),
      includes('')
    )
  );
});

Then('debería ver productos relacionados con {string}', async (termino: string) => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('.producto, .product, [class*="product"], mat-card')).describedAs('resultado búsqueda')),
      includes(termino)
    )
  );
});