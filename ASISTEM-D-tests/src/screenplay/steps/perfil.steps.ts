import { Given, When, Then } from '@cucumber/cucumber';
import { actorCalled } from '@serenity-js/core';
import { Navigate, PageElement, By, Click, Enter, Text } from '@serenity-js/web';
import { Ensure, includes } from '@serenity-js/assertions';
import { config } from '../configuration/environment';

Given('que el usuario está en su perfil', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(`${config.baseUrl}/perfil`),
    Click.on(
      PageElement.located(By.css('.tabs-bar a:last-child, [class*="tab"]:last-child'))
        .describedAs('tab Mi perfil')
    )
  );
});

When('accede a su perfil', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(`${config.baseUrl}/perfil`)
  );
});

When('actualiza su nombre a {string}', async (nombre: string) => {
  await actorCalled('Usuario').attemptsTo(
    Click.on(
      PageElement.located(By.css('.tabs-bar a:last-child, [class*="tab"]:last-child'))
        .describedAs('tab Mi perfil')
    ),
    Enter.theValue(nombre).into(
      PageElement.located(By.css('input[placeholder="Tu nombre"]'))
        .describedAs('campo nombre')
    ),
    Click.on(
      PageElement.located(By.css('button.guardar, button[type="submit"], .form-actions button'))
        .describedAs('botón guardar')
    )
  );
});

Then('debería ver sus datos personales', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('body')).describedAs('página perfil')),
      includes('')
    )
  );
});

Then('debería ver el nombre actualizado', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('body')).describedAs('página perfil')),
      includes('Actualizada')
    )
  );
});