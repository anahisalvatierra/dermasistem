@ui
Feature: Página de inicio (Landing)

  Scenario: Ver landing page sin sesión
    Given que el usuario no ha iniciado sesión
    When accede a la página principal
    Then debería ver la landing page con opciones de login y registro