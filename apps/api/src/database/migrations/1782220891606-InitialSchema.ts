import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1782220891606 implements MigrationInterface {
    name = 'InitialSchema1782220891606'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "name" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "target_url" text NOT NULL, "title" character varying(200), "owner_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_54ebf5dec4e16cbf8f22d44caec" UNIQUE ("slug"), CONSTRAINT "PK_ecf17f4a741d3c5ba0b4c5ab4b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_54ebf5dec4e16cbf8f22d44cae" ON "links" ("slug") `);
        await queryRunner.query(`CREATE INDEX "IDX_aaec178aa34bae31cd71207280" ON "links" ("owner_id") `);
        await queryRunner.query(`CREATE TABLE "clicks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "link_id" uuid NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ip_hash" character varying, "user_agent" text, "referrer" text, "country" character varying, CONSTRAINT "PK_7765d7ffdeb0ed2675651020814" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3e477bfbdf3a572363b65bc452" ON "clicks" ("link_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_3e477bfbdf3a572363b65bc452"`);
        await queryRunner.query(`DROP TABLE "clicks"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aaec178aa34bae31cd71207280"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_54ebf5dec4e16cbf8f22d44cae"`);
        await queryRunner.query(`DROP TABLE "links"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
