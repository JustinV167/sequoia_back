import mongoose from 'mongoose'
import { MigrationInterface, QueryRunner } from 'typeorm'

interface LegacyCourseContentRow {
  id: string
  design: unknown
  modules: unknown
}

export class MoveCourseContentToTemplates1792624000000
  implements MigrationInterface
{
  name = 'MoveCourseContentToTemplates1792624000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT "id", "design", "modules"
       FROM "courses"
       WHERE "design" IS NOT NULL
          OR "modules" IS NOT NULL`,
    )) as LegacyCourseContentRow[]

    if (rows.length > 0) {
      await this.copyTemplatesToMongo(rows)
    }

    await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "modules"`)
    await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "page"`)
    await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "design"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "courses" ADD "design" jsonb`)
    await queryRunner.query(`ALTER TABLE "courses" ADD "page" jsonb`)
    await queryRunner.query(`ALTER TABLE "courses" ADD "modules" jsonb`)
  }

  private async copyTemplatesToMongo(
    rows: LegacyCourseContentRow[],
  ): Promise<void> {
    const host = process.env.MONGO_HOST ?? 'localhost'
    const port = process.env.MONGO_PORT ?? '27017'
    const database = process.env.MONGO_DB ?? 'sequoia'
    const connection = mongoose.createConnection(
      `mongodb://${host}:${port}/${database}`,
      { serverSelectionTimeoutMS: 10000 },
    )
    let connected = false

    try {
      await connection.asPromise()
      connected = true
      const templates = connection.collection('course_templates')
      const now = new Date()

      for (const row of rows) {
        await templates.updateOne(
          { courseId: row.id },
          {
            $setOnInsert: {
              courseId: row.id,
              design: row.design,
              modules: row.modules,
              createdAt: now,
              updatedAt: now,
            },
          },
          { upsert: true },
        )
      }
    } finally {
      if (connected) {
        await connection.close()
      }
    }
  }
}
