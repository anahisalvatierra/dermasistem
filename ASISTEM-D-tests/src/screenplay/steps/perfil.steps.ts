import { Given, When, Then } from '@cucumber/cucumber';
import { actorCalled } from '@serenity-js/core';
import { Navigate, PageElement, By, Click, Enter, Text } from '@serenity-js/web';
import { Ensure, includes } from '@serenity-js/assertions';
import { config } from '../configuration/environment';

When('accede a su perfil', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(`${config.baseUrl}/perfil`)
  );
});

When('actualiza su nombre a {string}', async (nombre: string) => {
  await actorCalled('Usuario').attemptsTo(
    Enter.theValue(nombre).into(
      PageElement.located(By.css('input[name="nombre"], input[placeholder*="nombre"]'))
        .describedAs('campo nombre')
    ),
    Click.on(
      PageElement.located(By.css('button[type="submit"]')).describedAs('botón guardar')
    )
  );
});

Then('debería ver sus datos personales', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('.perfil, .profile, [class*="perfil"]')).describedAs('sección perfil')),
      includes('')
    )
  );
});

Then('debería ver el nombre actualizado', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('.perfil, .profile, [class*="perfil"]')).describedAs('nombre actualizado')),
      includes('Actualizada')
    )
  );
});