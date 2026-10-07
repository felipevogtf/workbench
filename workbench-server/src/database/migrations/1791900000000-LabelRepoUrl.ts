import { MigrationInterface, QueryRunner } from 'typeorm';

export class LabelRepoUrl1791900000000 implements MigrationInterface {
  name = 'LabelRepoUrl1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "labels" ADD "repo_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "labels" DROP COLUMN "repo_url"`);
  }
}
