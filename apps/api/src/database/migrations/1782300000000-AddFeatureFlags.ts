import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeatureFlags1782300000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "feature_flags" (
        "key" varchar(80) PRIMARY KEY,
        "enabled" boolean NOT NULL DEFAULT false,
        "description" text,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )`,
    );
    // Ship the flag OFF — a release flips it on without a redeploy.
    await q.query(
      `INSERT INTO "feature_flags" ("key", "enabled", "description")
       VALUES ('link_title_preview', false,
               'Auto-fetch the target page <title> when creating a link (server-side UrlPreviewProvider).')`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "feature_flags"`);
  }
}
