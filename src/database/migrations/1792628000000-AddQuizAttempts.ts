import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Server-authoritative quiz attempts.
 *
 * The row owns the deadline, the latest autosaved answers, the final score and
 * the soft anti-cheat counters. It survives page reloads, tab closes and power
 * outages, so the student can resume exactly where the last autosave left off.
 */
export class AddQuizAttempts1792628000000 implements MigrationInterface {
  name = 'AddQuizAttempts1792628000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quiz_attempts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "course_id" uuid NOT NULL,
        "template_id" uuid,
        "student_id" uuid NOT NULL,
        "lesson_id" character varying(200) NOT NULL,
        "quiz_title" character varying(200),
        "status" character varying(20) NOT NULL DEFAULT 'in_progress',
        "attempt_number" integer NOT NULL DEFAULT 1,
        "question_count" integer NOT NULL DEFAULT 0,
        "time_limit_minutes" integer NOT NULL DEFAULT 0,
        "pass_score" smallint NOT NULL DEFAULT 60,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "submitted_at" TIMESTAMP WITH TIME ZONE,
        "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "results" jsonb,
        "score" numeric(5,2),
        "correct_count" integer NOT NULL DEFAULT 0,
        "incorrect_count" integer NOT NULL DEFAULT 0,
        "review_count" integer NOT NULL DEFAULT 0,
        "passed" boolean,
        "time_spent_seconds" integer NOT NULL DEFAULT 0,
        "focus_lost_count" integer NOT NULL DEFAULT 0,
        "tab_hidden_seconds" integer NOT NULL DEFAULT 0,
        "paste_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_attempts" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_quiz_attempts_status"
          CHECK ("status" IN ('in_progress', 'submitted', 'expired'))
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "quiz_attempts_student_course_lesson_attempt_unique"
      ON "quiz_attempts" ("student_id", "course_id", "lesson_id", "attempt_number")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "quiz_attempts_course_idx"
      ON "quiz_attempts" ("course_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "quiz_attempts_course_student_idx"
      ON "quiz_attempts" ("course_id", "student_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "quiz_attempts_active_idx"
      ON "quiz_attempts" ("student_id", "course_id", "lesson_id", "status")
    `)

    await queryRunner.query(`
      ALTER TABLE "quiz_attempts"
      ADD CONSTRAINT "FK_quiz_attempts_course"
      FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "quiz_attempts"
      ADD CONSTRAINT "FK_quiz_attempts_template"
      FOREIGN KEY ("template_id") REFERENCES "course_templates"("id")
      ON DELETE SET NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "quiz_attempts"
      ADD CONSTRAINT "FK_quiz_attempts_student"
      FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "quiz_attempts" CASCADE`)
  }
}
