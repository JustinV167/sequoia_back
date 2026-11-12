import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCourseContent1792623000000 implements MigrationInterface {
  name = 'AddCourseContent1792623000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "courses" ADD "design" jsonb`,
    )
    await queryRunner.query(
      `ALTER TABLE "courses" ADD "page" jsonb`,
    )
    await queryRunner.query(
      `ALTER TABLE "courses" ADD "modules" jsonb`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "modules"`)
    await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "page"`)
    await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "design"`)
  }
}
