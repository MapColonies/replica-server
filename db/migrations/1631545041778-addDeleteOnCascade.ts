import { MigrationInterface, QueryRunner } from 'typeorm';

export class addDeleteOnCascade1631545041778 implements MigrationInterface {
  name = 'addDeleteOnCascade1631545041778';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "replica_server"."file"
            ADD CONSTRAINT "FK_32051e08f46159884e78bcc8c4f" FOREIGN KEY ("replica_id") REFERENCES "replica_server"."replica"("replica_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "replica_server"."file" DROP CONSTRAINT "FK_32051e08f46159884e78bcc8c4f"
        `);
  }
}
