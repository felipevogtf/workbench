import { MigrationInterface, QueryRunner } from "typeorm";

export class TimeTracking1785390098047 implements MigrationInterface {
    name = 'TimeTracking1785390098047'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "time_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hours" numeric(4,2) NOT NULL, "date" date NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "issue_id" uuid, CONSTRAINT "PK_b8bc5f10269ba2fe88708904aa0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "time_entries" ADD CONSTRAINT "FK_7fe9f51dcc2bba234e1c06402aa" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "time_entries" DROP CONSTRAINT "FK_7fe9f51dcc2bba234e1c06402aa"`);
        await queryRunner.query(`DROP TABLE "time_entries"`);
    }

}
