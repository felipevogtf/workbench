import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProjectDto {
  /** Solo en los proyectos locales. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  /** Solo en los de Plane: si el sync trae sus tareas. */
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  /** Si el proyecto y sus tareas aparecen en la app. */
  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}
