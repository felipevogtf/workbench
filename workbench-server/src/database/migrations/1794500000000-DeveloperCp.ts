import { MigrationInterface, QueryRunner } from 'typeorm';

const TOOL = 'Bash(cp:*)';

/**
 * Un desarrollador debe poder copiar un archivo (duplicar un audio, una imagen o una fuente con otro nombre): `Write` solo escribe texto,
 * así que sin `cp` la ejecución se atasca cuando el revisor pide un archivo binario nuevo. Se suma a todos los desarrolladores que
 * todavía no lo tengan.
 */
export class DeveloperCp1794500000000 implements MigrationInterface {
  name = 'DeveloperCp1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "allowed_tools" = array_append("allowed_tools", $1)
        WHERE "module" = 'task-developer' AND NOT ($1 = ANY("allowed_tools"))`,
      [TOOL],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "agents" SET "allowed_tools" = array_remove("allowed_tools", $1)
        WHERE "module" = 'task-developer'`,
      [TOOL],
    );
  }
}
