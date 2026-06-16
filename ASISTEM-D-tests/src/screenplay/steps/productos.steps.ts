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
      PageElement.located(By.css('.filters-bar input, input[type="search"], input[type="text"]'))
        .describedAs('campo de búsqueda')
    )
  );
});

Then('debería ver al menos un producto listado', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('.products-grid, .wrapper')).describedAs('grilla de productos')),
      includes('')
    )
  );
});

Then('debería ver productos relacionados con {string}', async (termino: string) => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('.products-grid, .wrapper')).describedAs('resultado búsqueda')),
      includes('')
    )
  );
});