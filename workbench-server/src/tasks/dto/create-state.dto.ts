import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  color?: string | null;

  // Opcional: sin posición, el estado queda al final.
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  /** Las tareas en este estado cuentan como finalizadas. */
  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}
