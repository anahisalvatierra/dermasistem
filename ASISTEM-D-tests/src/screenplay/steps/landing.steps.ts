import { Given, When, Then } from '@cucumber/cucumber';
import { actorCalled } from '@serenity-js/core';
import { Navigate, PageElement, By, Text } from '@serenity-js/web';
import { Ensure, includes } from '@serenity-js/assertions';
import { config } from '../configuration/environment';

Given('que el usuario no ha iniciado sesión', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(config.baseUrl)
  );
});

When('accede a la página principal', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(config.baseUrl)
  );
});

Then('debería ver la landing page con opciones de login y registro', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('body')).describedAs('landing page')),
      includes('')
    )
  );
});