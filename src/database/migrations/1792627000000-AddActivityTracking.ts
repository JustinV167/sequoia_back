import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Stores every learning interaction in two layers:
 *
 *  - `activity_events`: append-only raw log (one row per client event).
 *  - `course_activity`, `module_activity`, `lesson_activity` and
 *    `exercise_activity`: rolling aggregates keyed by student, so dashboards
 *    never need to scan the raw log.
 *
 * Raw events are the source of truth; aggregates are recomputed from them
 * inside the same transaction, which keeps both layers consistent.
 */
export class AddActivityTracking1792627000000 implements MigrationInterface {
  name = 'AddActivityTracking1792627000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" character varying(64) NOT NULL,
        "user_id" uuid NOT NULL,
        "session_id" uuid,
        "course_id" uuid,
        "template_id" uuid,
        "enrollment_id" uuid,
        "module_id" character varying(200),
        "lesson_id" character varying(200),
        "exercise_id" character varying(200),
        "event_type" character varying(64) NOT NULL,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "duration_ms" integer,
        "position_seconds" integer,
        "duration_seconds" integer,
        "progress_percent" numeric(5,2),
        "score" numeric(5,4),
        "attempt_number" integer,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "ip_address" character varying(64),
        "user_agent" character varying(512),
        CONSTRAINT "PK_activity_events" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "activity_events_event_id_unique"
      ON "activity_events" ("event_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "activity_events_user_occurred_idx"
      ON "activity_events" ("user_id", "occurred_at" DESC)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "activity_events_course_occurred_idx"
      ON "activity_events" ("course_id", "occurred_at" DESC)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "activity_events_course_user_idx"
      ON "activity_events" ("course_id", "user_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "activity_events_module_idx"
      ON "activity_events" ("module_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "activity_events_lesson_idx"
      ON "activity_events" ("lesson_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "activity_events_exercise_idx"
      ON "activity_events" ("exercise_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "activity_events_type_idx"
      ON "activity_events" ("event_type")
    `)

    await queryRunner.query(`
      ALTER TABLE "activity_events"
      ADD CONSTRAINT "FK_activity_events_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "activity_events"
      ADD CONSTRAINT "FK_activity_events_session"
      FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "activity_events"
      ADD CONSTRAINT "FK_activity_events_course"
      FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "activity_events"
      ADD CONSTRAINT "FK_activity_events_template"
      FOREIGN KEY ("template_id") REFERENCES "course_templates"("id")
      ON DELETE SET NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "activity_events"
      ADD CONSTRAINT "FK_activity_events_enrollment"
      FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id")
      ON DELETE SET NULL
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_activity" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "course_id" uuid NOT NULL,
        "first_opened_at" TIMESTAMP WITH TIME ZONE,
        "last_opened_at" TIMESTAMP WITH TIME ZONE,
        "visits" integer NOT NULL DEFAULT 0,
        "total_time_seconds" integer NOT NULL DEFAULT 0,
        "lessons_total" integer NOT NULL DEFAULT 0,
        "lessons_completed" integer NOT NULL DEFAULT 0,
        "exercises_attempted" integer NOT NULL DEFAULT 0,
        "exercises_correct" integer NOT NULL DEFAULT 0,
        "progress_percent" smallint NOT NULL DEFAULT 0,
        "last_module_id" character varying(200),
        "last_lesson_id" character varying(200),
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_activity" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_course_activity_progress"
          CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100)
      )
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "course_activity_user_course_unique"
      ON "course_activity" ("user_id", "course_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "course_activity_course_idx"
      ON "course_activity" ("course_id")
    `)
    await queryRunner.query(`
      ALTER TABLE "course_activity"
      ADD CONSTRAINT "FK_course_activity_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "course_activity"
      ADD CONSTRAINT "FK_course_activity_course"
      FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "module_activity" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "course_id" uuid NOT NULL,
        "module_id" character varying(200) NOT NULL,
        "module_title" character varying(200),
        "first_viewed_at" TIMESTAMP WITH TIME ZONE,
        "last_viewed_at" TIMESTAMP WITH TIME ZONE,
        "visits" integer NOT NULL DEFAULT 0,
        "total_time_seconds" integer NOT NULL DEFAULT 0,
        "lessons_total" integer NOT NULL DEFAULT 0,
        "lessons_completed" integer NOT NULL DEFAULT 0,
        "progress_percent" smallint NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_module_activity" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_module_activity_progress"
          CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100)
      )
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "module_activity_user_course_module_unique"
      ON "module_activity" ("user_id", "course_id", "module_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "module_activity_course_idx"
      ON "module_activity" ("course_id")
    `)
    await queryRunner.query(`
      ALTER TABLE "module_activity"
      ADD CONSTRAINT "FK_module_activity_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "module_activity"
      ADD CONSTRAINT "FK_module_activity_course"
      FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_activity" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "course_id" uuid NOT NULL,
        "module_id" character varying(200),
        "lesson_id" character varying(200) NOT NULL,
        "lesson_title" character varying(200),
        "lesson_type" character varying(32),
        "first_viewed_at" TIMESTAMP WITH TIME ZONE,
        "last_viewed_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "total_time_seconds" integer NOT NULL DEFAULT 0,
        "visits" integer NOT NULL DEFAULT 0,
        "last_position_seconds" integer,
        "video_duration_seconds" integer,
        "progress_percent" smallint NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_activity" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_lesson_activity_progress"
          CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100)
      )
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "lesson_activity_user_course_lesson_unique"
      ON "lesson_activity" ("user_id", "course_id", "lesson_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "lesson_activity_course_idx"
      ON "lesson_activity" ("course_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "lesson_activity_module_idx"
      ON "lesson_activity" ("course_id", "module_id")
    `)
    await queryRunner.query(`
      ALTER TABLE "lesson_activity"
      ADD CONSTRAINT "FK_lesson_activity_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "lesson_activity"
      ADD CONSTRAINT "FK_lesson_activity_course"
      FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "exercise_activity" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "course_id" uuid NOT NULL,
        "module_id" character varying(200),
        "lesson_id" character varying(200),
        "exercise_id" character varying(200) NOT NULL,
        "exercise_type" character varying(32),
        "prompt" text,
        "first_started_at" TIMESTAMP WITH TIME ZONE,
        "last_started_at" TIMESTAMP WITH TIME ZONE,
        "first_attempted_at" TIMESTAMP WITH TIME ZONE,
        "last_attempted_at" TIMESTAMP WITH TIME ZONE,
        "solved_at" TIMESTAMP WITH TIME ZONE,
        "starts" integer NOT NULL DEFAULT 0,
        "retries" integer NOT NULL DEFAULT 0,
        "attempts" integer NOT NULL DEFAULT 0,
        "correct_attempts" integer NOT NULL DEFAULT 0,
        "incorrect_attempts" integer NOT NULL DEFAULT 0,
        "review_attempts" integer NOT NULL DEFAULT 0,
        "best_score" numeric(5,4),
        "last_score" numeric(5,4),
        "total_time_seconds" integer NOT NULL DEFAULT 0,
        "last_answer" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_exercise_activity" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "exercise_activity_user_course_exercise_unique"
      ON "exercise_activity" ("user_id", "course_id", "exercise_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "exercise_activity_course_idx"
      ON "exercise_activity" ("course_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "exercise_activity_lesson_idx"
      ON "exercise_activity" ("course_id", "lesson_id")
    `)
    await queryRunner.query(`
      ALTER TABLE "exercise_activity"
      ADD CONSTRAINT "FK_exercise_activity_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "exercise_activity"
      ADD CONSTRAINT "FK_exercise_activity_course"
      FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "exercise_activity" CASCADE`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_activity" CASCADE`)
    await queryRunner.query(`DROP TABLE IF EXISTS "module_activity" CASCADE`)
    await queryRunner.query(`DROP TABLE IF EXISTS "course_activity" CASCADE`)
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_events" CASCADE`)
  }
}
