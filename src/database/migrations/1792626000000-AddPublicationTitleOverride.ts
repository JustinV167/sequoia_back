import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Publications can be published with their own title (for example a template
 * named "Matemática" published as "Mate secc 2"). Template title edits must
 * not overwrite those custom titles.
 */
export class AddPublicationTitleOverride1792626000000
  implements MigrationInterface
{
  name = 'AddPublicationTitleOverride1792626000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "title_overridden" boolean NOT NULL DEFAULT false
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
      DROP COLUMN IF EXISTS "title_overridden"
    `)
  }
}
