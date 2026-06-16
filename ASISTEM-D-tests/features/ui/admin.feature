@ui @admin
Feature: Panel de administración

  Scenario: Acceso al panel admin
    Given que el usuario administrador ha iniciado sesión
    When accede al panel de administración
    Then debería ver las opciones de gestión

  Scenario: Usuario sin permisos no puede acceder al admin
    Given que un usuario normal ha iniciado sesión
    When intenta acceder a la ruta de administración
    Then debería ser redirigido o ver acceso denegado