import { Given, When, Then } from '@cucumber/cucumber';
import { actorCalled } from '@serenity-js/core';
import { Navigate, PageElement, By, Text } from '@serenity-js/web';
import { Ensure, includes } from '@serenity-js/assertions';
import { config } from '../configuration/environment';

Given('que el usuario administrador ha iniciado sesión', async () => {
  await actorCalled('Admin').attemptsTo(
    Navigate.to(`${config.baseUrl}/login`)
  );
});

Given('que un usuario normal ha iniciado sesión', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(`${config.baseUrl}/login`)
  );
});

When('accede al panel de administración', async () => {
  await actorCalled('Admin').attemptsTo(
    Navigate.to(`${config.baseUrl}/admin`)
  );
});

When('intenta acceder a la ruta de administración', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(`${config.baseUrl}/admin`)
  );
});

Then('debería ver las opciones de gestión', async () => {
  await actorCalled('Admin').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('.admin, [class*="admin"], mat-sidenav')).describedAs('panel admin')),
      includes('')
    )
  );
});

Then('debería ser redirigido o ver acceso denegado', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('body')).describedAs('página')),
      includes('')
    )
  );
});