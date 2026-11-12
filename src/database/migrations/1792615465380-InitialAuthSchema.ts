import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialAuthSchema1792615465380 implements MigrationInterface {
    name = 'InitialAuthSchema1792615465380'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('student', 'teacher')`);
        await queryRunner.query(`CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "full_name" character varying(120) NOT NULL, "roles" "public"."user_role" array NOT NULL, "status" "public"."user_status" NOT NULL DEFAULT 'active', "email_verified_at" TIMESTAMP WITH TIME ZONE, "avatar_url" character varying(500), "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token_hash" character varying(64) NOT NULL, "user_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ip_address" character varying(64), "user_agent" character varying(512), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" ("token_hash") `);
        await queryRunner.query(`CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."verification_purpose" AS ENUM('register', 'reset_password', 'change_email')`);
        await queryRunner.query(`CREATE TABLE "verification_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "purpose" "public"."verification_purpose" NOT NULL, "code_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "verified_at" TIMESTAMP WITH TIME ZONE, "consumed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18741b6b8bf1680dbf5057421d7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "verification_codes_expires_at_idx" ON "verification_codes" ("expires_at") `);
        await queryRunner.query(`CREATE INDEX "verification_codes_lookup_idx" ON "verification_codes" ("email", "purpose", "created_at") `);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"`);
        await queryRunner.query(`DROP INDEX "public"."verification_codes_lookup_idx"`);
        await queryRunner.query(`DROP INDEX "public"."verification_codes_expires_at_idx"`);
        await queryRunner.query(`DROP TABLE "verification_codes"`);
        await queryRunner.query(`DROP TYPE "public"."verification_purpose"`);
        await queryRunner.query(`DROP INDEX "public"."sessions_user_id_idx"`);
        await queryRunner.query(`DROP INDEX "public"."sessions_token_hash_unique"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP INDEX "public"."users_email_unique"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."user_status"`);
        await queryRunner.query(`DROP TYPE "public"."user_role"`);
    }

}
