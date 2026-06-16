@ui @auth
Feature: Registro de nuevo usuario

  Scenario: Registro exitoso
    Given que el usuario está en la página de registro
    When completa el formulario con email "ana@test.com" y contraseña "Test1234"
    Then debería recibir confirmación de registro

  Scenario: Registro con email ya existente
    Given que el usuario está en la página de registro
    When intenta registrarse con un email ya registrado "test@dermasistem.com"
    Then debería ver un mensaje de email duplicado