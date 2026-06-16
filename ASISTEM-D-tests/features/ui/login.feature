@ui @auth
Feature: Login de usuario

  Scenario: Login exitoso con credenciales válidas
    Given que el usuario está en la página de login
    When ingresa email "test@dermasistem.com" y contraseña "Test1234"
    Then debería ver el dashboard

  Scenario: Login fallido con credenciales incorrectas
    Given que el usuario está en la página de login
    When ingresa email "invalido@test.com" y contraseña "wrongpass"
    Then debería ver un mensaje de error de credenciales