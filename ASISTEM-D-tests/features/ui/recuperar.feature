@ui @auth
Feature: Recuperación de contraseña

  Scenario: Solicitar recuperación de contraseña
    Given que el usuario está en la página de recuperar contraseña
    When ingresa su email "test@dermasistem.com"
    Then debería ver un mensaje de email enviado