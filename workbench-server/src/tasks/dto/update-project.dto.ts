export class UpdateProjectDto {
  /** Solo en los proyectos locales. */
  name?: string;
  /** Solo en los de Plane: si el sync trae sus tareas. */
  syncEnabled?: boolean;
  /** Si el proyecto y sus tareas aparecen en la app. */
  visible?: boolean;
}
