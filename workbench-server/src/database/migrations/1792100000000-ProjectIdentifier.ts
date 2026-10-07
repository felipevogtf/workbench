import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectIdentifier1792100000000 implements MigrationInterface {
  name = 'ProjectIdentifier1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "identifier" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "identifier"`);
  }
}
