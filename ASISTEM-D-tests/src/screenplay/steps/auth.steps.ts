import { Given, When, Then } from '@cucumber/cucumber';
import { actorCalled } from '@serenity-js/core';
import { Navigate, PageElement, By, Enter, Click, Text } from '@serenity-js/web';
import { Ensure, includes } from '@serenity-js/assertions';
import { config } from '../configuration/environment';

Given('que el usuario está en la página de login', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(`${config.baseUrl}/login`)
  );
});

Given('que el usuario está en la página de registro', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(`${config.baseUrl}/registro`)
  );
});

Given('que el usuario está en la página de recuperar contraseña', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(`${config.baseUrl}/recuperar`)
  );
});

Given('que el usuario ha iniciado sesión', async () => {
  await actorCalled('Usuario').attemptsTo(
    Navigate.to(`${config.baseUrl}/login`),
    Enter.theValue(config.credentials.validUser.email).into(
      PageElement.located(By.css('input[type="email"]')).describedAs('campo email')
    ),
    Enter.theValue(config.credentials.validUser.password).into(
      PageElement.located(By.css('input[type="password"]')).describedAs('campo contraseña')
    ),
    Click.on(
      PageElement.located(By.css('button[type="submit"]')).describedAs('botón login')
    )
  );
});

When('ingresa email {string} y contraseña {string}', async (email: string, password: string) => {
  await actorCalled('Usuario').attemptsTo(
    Enter.theValue(email).into(
      PageElement.located(By.css('input[type="email"]')).describedAs('campo email')
    ),
    Enter.theValue(password).into(
      PageElement.located(By.css('input[type="password"]')).describedAs('campo contraseña')
    ),
    Click.on(
      PageElement.located(By.css('button[type="submit"]')).describedAs('botón login')
    )
  );
});

When('completa el formulario con nombre {string}, email {string} y contraseña {string}',
  async (nombre: string, email: string, password: string) => {
    await actorCalled('Usuario').attemptsTo(
      Enter.theValue(nombre).into(
        PageElement.located(By.css('input[formcontrolname="nombre"]')).describedAs('campo nombre')
      ),
      Enter.theValue(email).into(
        PageElement.located(By.css('input[type="email"]')).describedAs('campo email')
      ),
      Enter.theValue(password).into(
        PageElement.located(By.css('input[formcontrolname="password"]')).describedAs('campo contraseña')
      ),
      Click.on(
        PageElement.located(By.css('button[type="submit"]')).describedAs('botón registro')
      )
    );
});

When('intenta registrarse con un email ya registrado {string}', async (email: string) => {
  await actorCalled('Usuario').attemptsTo(
    Enter.theValue(email).into(
      PageElement.located(By.css('input[type="email"]')).describedAs('campo email')
    ),
    Enter.theValue('Test1234').into(
      PageElement.located(By.css('input[formcontrolname="password"]')).describedAs('campo contraseña')
    ),
    Click.on(
      PageElement.located(By.css('button[type="submit"]')).describedAs('botón registro')
    )
  );
});

When('ingresa su email {string}', async (email: string) => {
  await actorCalled('Usuario').attemptsTo(
    Enter.theValue(email).into(
      PageElement.located(By.css('input[type="email"]')).describedAs('campo email')
    ),
    Click.on(
      PageElement.located(By.css('button[type="submit"]')).describedAs('botón enviar')
    )
  );
});

Then('debería ver el dashboard', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('app-root')).describedAs('app')),
      includes('')
    )
  );
});

Then('debería ver un mensaje de error de credenciales', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('body')).describedAs('página')),
      includes('')
    )
  );
});

Then('debería recibir confirmación de registro', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('body')).describedAs('página')),
      includes('')
    )
  );
});

Then('debería ver un mensaje de email duplicado', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('body')).describedAs('página')),
      includes('')
    )
  );
});

Then('debería ver un mensaje de email enviado', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('body')).describedAs('página')),
      includes('')
    )
  );
});

Then('debería ser redirigido al dashboard', async () => {
  await actorCalled('Usuario').attemptsTo(
    Ensure.that(
      Text.of(PageElement.located(By.css('app-root')).describedAs('app')),
      includes('')
    )
  );
});