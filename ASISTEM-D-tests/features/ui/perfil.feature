@ui
Feature: Perfil de usuario

  Scenario: Ver perfil
    Given que el usuario ha iniciado sesión
    When accede a su perfil
    Then debería ver sus datos personales

  Scenario: Editar perfil
    Given que el usuario está en su perfil
    When actualiza su nombre a "Ana Actualizada"
    Then debería ver el nombre actualizado