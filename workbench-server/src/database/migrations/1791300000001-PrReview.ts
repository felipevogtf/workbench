import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrReview1791300000001 implements MigrationInterface {
  name = 'PrReview1791300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "pull_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" character varying NOT NULL, "repo" character varying NOT NULL, "external_id" character varying NOT NULL, "url" character varying NOT NULL, "title" character varying NOT NULL, "author" character varying NOT NULL, "source_branch" character varying NOT NULL, "dest_branch" character varying NOT NULL, "head_commit" character varying NOT NULL, "state" character varying NOT NULL DEFAULT 'open', "status" character varying NOT NULL DEFAULT 'pending', "queued_at" TIMESTAMP NOT NULL, "requested_agent_id" uuid, "requested_model" character varying, "last_reviewed_at" TIMESTAMP, "review_doc_url" character varying, "reviewed_commit" character varying, "last_error" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_pull_requests_provider_repo_external_id" UNIQUE ("provider", "repo", "external_id"), CONSTRAINT "PK_pull_requests_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pull_requests_status_queued_at" ON "pull_requests" ("status", "queued_at")`,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pull_request_id" uuid NOT NULL, "commit" character varying, "agent_id" uuid, "agent_name" character varying, "model" character varying, "doc_path" character varying, "status" character varying NOT NULL, "error" text, "comment_status" character varying NOT NULL, "comment_url" character varying, "comment_error" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_reviews_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_pull_request_id" ON "reviews" ("pull_request_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_reviews_pull_request_id" FOREIGN KEY ("pull_request_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_reviews_pull_request_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_reviews_pull_request_id"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP INDEX "IDX_pull_requests_status_queued_at"`);
    await queryRunner.query(`DROP TABLE "pull_requests"`);
  }
}
