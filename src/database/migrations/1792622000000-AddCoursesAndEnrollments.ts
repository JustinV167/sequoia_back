import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCoursesAndEnrollments1792622000000
  implements MigrationInterface
{
  name = 'AddCoursesAndEnrollments1792622000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."course_level" AS ENUM('beginner', 'intermediate', 'advanced')`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."course_status" AS ENUM('draft', 'published', 'archived')`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'completed', 'cancelled')`,
    )

    await queryRunner.query(`
      CREATE TABLE "courses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL,
        "title" character varying(160) NOT NULL,
        "subject" character varying(100) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "level" "public"."course_level" NOT NULL,
        "duration_minutes" integer,
        "cover_url" character varying(500),
        "status" "public"."course_status" NOT NULL DEFAULT 'draft',
        "published_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courses_id" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(
      `CREATE INDEX "courses_teacher_id_idx" ON "courses" ("teacher_id")`,
    )
    await queryRunner.query(
      `CREATE INDEX "courses_status_idx" ON "courses" ("status")`,
    )
    await queryRunner.query(
      `ALTER TABLE "courses" ADD CONSTRAINT "FK_courses_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    )

    await queryRunner.query(`
      CREATE TABLE "enrollments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "course_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "status" "public"."enrollment_status" NOT NULL DEFAULT 'active',
        "progress_percent" smallint NOT NULL DEFAULT 0,
        "enrolled_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enrollments_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_enrollments_progress_percent" CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100)
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "enrollments_course_student_unique" ON "enrollments" ("course_id", "student_id")`,
    )
    await queryRunner.query(
      `CREATE INDEX "enrollments_course_id_idx" ON "enrollments" ("course_id")`,
    )
    await queryRunner.query(
      `CREATE INDEX "enrollments_student_id_idx" ON "enrollments" ("student_id")`,
    )
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_enrollments_course_id" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_enrollments_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_enrollments_student_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_enrollments_course_id"`,
    )
    await queryRunner.query(`DROP INDEX "public"."enrollments_student_id_idx"`)
    await queryRunner.query(`DROP INDEX "public"."enrollments_course_id_idx"`)
    await queryRunner.query(
      `DROP INDEX "public"."enrollments_course_student_unique"`,
    )
    await queryRunner.query(`DROP TABLE "enrollments"`)
    await queryRunner.query(`DROP TYPE "public"."enrollment_status"`)

    await queryRunner.query(
      `ALTER TABLE "courses" DROP CONSTRAINT "FK_courses_teacher_id"`,
    )
    await queryRunner.query(`DROP INDEX "public"."courses_status_idx"`)
    await queryRunner.query(`DROP INDEX "public"."courses_teacher_id_idx"`)
    await queryRunner.query(`DROP TABLE "courses"`)
    await queryRunner.query(`DROP TYPE "public"."course_status"`)
    await queryRunner.query(`DROP TYPE "public"."course_level"`)
  }
}
