import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Splits the old single "course" concept into:
 *  - course_templates: reusable, editable course definitions.
 *  - courses: publications created from a template.
 *
 * Existing courses become both a template and its first publication. The
 * template keeps the same id so the MongoDB content documents (still keyed by
 * `courseId`) remain valid without a second migration.
 */
export class CreateCourseTemplates1792625000000
  implements MigrationInterface
{
  name = 'CreateCourseTemplates1792625000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "course_level" AS ENUM ('beginner', 'intermediate', 'advanced');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL,
        "title" character varying(160) NOT NULL,
        "subject" character varying(100) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "level" "public"."course_level" NOT NULL,
        "duration_minutes" integer,
        "cover_url" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_templates" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "template_id" uuid
    `)

    // Every pre-existing course becomes a template (same id) and keeps its
    // current row as the publication created from it.
    await queryRunner.query(`
      INSERT INTO "course_templates" (
        "id",
        "teacher_id",
        "title",
        "subject",
        "description",
        "level",
        "duration_minutes",
        "cover_url",
        "created_at",
        "updated_at"
      )
      SELECT
        course."id",
        course."teacher_id",
        course."title",
        course."subject",
        course."description",
        course."level",
        course."duration_minutes",
        course."cover_url",
        course."created_at",
        course."updated_at"
      FROM "courses" AS course
      WHERE NOT EXISTS (
        SELECT 1
        FROM "course_templates" AS template
        WHERE template."id" = course."id"
      )
    `)

    await queryRunner.query(`
      UPDATE "courses"
      SET "template_id" = "id"
      WHERE "template_id" IS NULL
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_course_templates_teacher'
        ) THEN
          ALTER TABLE "course_templates"
          ADD CONSTRAINT "FK_course_templates_teacher"
          FOREIGN KEY ("teacher_id") REFERENCES "users"("id")
          ON DELETE RESTRICT;
        END IF;
      END $$;
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_courses_template'
        ) THEN
          ALTER TABLE "courses"
          ADD CONSTRAINT "FK_courses_template"
          FOREIGN KEY ("template_id") REFERENCES "course_templates"("id")
          ON DELETE CASCADE;
        END IF;
      END $$;
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "course_templates_teacher_id_idx"
      ON "course_templates" ("teacher_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "courses_template_id_idx"
      ON "courses" ("template_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "courses_template_id_idx"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "course_templates_teacher_id_idx"
    `)
    await queryRunner.query(`
      ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "FK_courses_template"
    `)
    await queryRunner.query(`
      ALTER TABLE "course_templates"
      DROP CONSTRAINT IF EXISTS "FK_course_templates_teacher"
    `)
    await queryRunner.query(`
      ALTER TABLE "courses" DROP COLUMN IF EXISTS "template_id"
    `)
    await queryRunner.query(`
      DROP TABLE IF EXISTS "course_templates"
    `)
  }
}
