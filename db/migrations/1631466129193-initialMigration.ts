import { MigrationInterface, QueryRunner } from 'typeorm';

export class initialMigration1631466129193 implements MigrationInterface {
  name = 'initialMigration1631466129193';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "replica_server"."file" (
                "file_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "replica_id" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_37d2332c95c19b4882bdab5e261" PRIMARY KEY ("file_id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "replica_server"."replica_geometry_type_enum" AS ENUM('point', 'linestring', 'polygon')
        `);
    await queryRunner.query(`
            CREATE TYPE "replica_server"."replica_replica_type_enum" AS ENUM('delta', 'snapshot')
        `);
    await queryRunner.query(`
            CREATE TABLE "replica_server"."replica" (
                "id" uuid NOT NULL,
                "sync_id" uuid NOT NULL,
                "layer_id" integer NOT NULL,
                "geometry_type" "replica_server"."replica_geometry_type_enum" NOT NULL,
                "replica_type" "replica_server"."replica_replica_type_enum" NOT NULL,
                "is_hidden" boolean NOT NULL DEFAULT true,
                "bucket_name" character varying(63) NOT NULL,
                "timestamp" TIMESTAMP NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_f319ce5a90abd2823a9cdd08c24" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "replica_server"."layer_geometry_types_enum" AS ENUM('point', 'linestring', 'polygon')
        `);
    await queryRunner.query(`
            CREATE TABLE "replica_server"."layer" (
                "layer_id" integer NOT NULL,
                "layer_name" character varying NOT NULL,
                "geometry_types" "replica_server"."layer_geometry_types_enum" array NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_0cfa1f5745d3dd9ac6dadaa1e00" PRIMARY KEY ("layer_id")
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE "replica_server"."layer"
        `);
    await queryRunner.query(`
            DROP TYPE "replica_server"."layer_geometry_types_enum"
        `);
    await queryRunner.query(`
            DROP TABLE "replica_server"."replica"
        `);
    await queryRunner.query(`
            DROP TYPE "replica_server"."replica_replica_type_enum"
        `);
    await queryRunner.query(`
            DROP TYPE "replica_server"."replica_geometry_type_enum"
        `);
    await queryRunner.query(`
            DROP TABLE "replica_server"."file"
        `);
  }
}
