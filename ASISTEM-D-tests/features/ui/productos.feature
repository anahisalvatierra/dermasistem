@ui
Feature: Módulo de productos

  Scenario: Ver listado de productos
    Given que el usuario ha iniciado sesión
    When navega a la sección de productos
    Then debería ver al menos un producto listado

  Scenario: Buscar un producto
    Given que el usuario está en la sección de productos
    When busca "hidratante"
    Then debería ver productos relacionados con "hidratante"