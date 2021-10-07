import { MigrationInterface, QueryRunner } from 'typeorm';

export class initialMigration1631545006431 implements MigrationInterface {
  name = 'initialMigration1631545006431';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(`
            CREATE TYPE "replica_server"."replica_geometry_type_enum" AS ENUM('point', 'linestring', 'polygon')
        `);
    await queryRunner.query(`
            CREATE TYPE "replica_server"."replica_replica_type_enum" AS ENUM('delta', 'snapshot')
        `);
    await queryRunner.query(`
            CREATE TABLE "replica_server"."replica" (
                "replica_id" uuid NOT NULL,
                "layer_id" integer NOT NULL,
                "geometry_type" "replica_server"."replica_geometry_type_enum" NOT NULL,
                "replica_type" "replica_server"."replica_replica_type_enum" NOT NULL,
                "is_hidden" boolean NOT NULL DEFAULT true,
                "bucket_name" character varying(63) NOT NULL,
                "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_838dedd10f448057a5616102d17" PRIMARY KEY ("replica_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_4316150c3e1094e32e30aef76d" ON "replica_server"."replica" ("layer_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_e9ff04545263098241155f870b" ON "replica_server"."replica" ("bucket_name")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_4abe270367d0781e429c6ff123" ON "replica_server"."replica" ("timestamp")
        `);
    await queryRunner.query(`
            CREATE TABLE "replica_server"."file" (
                "file_id" uuid NOT NULL,
                "replica_id" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_37d2332c95c19b4882bdab5e261" PRIMARY KEY ("file_id")
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE "replica_server"."file"
        `);
    await queryRunner.query(`
            DROP INDEX "replica_server"."IDX_4abe270367d0781e429c6ff123"
        `);
    await queryRunner.query(`
            DROP INDEX "replica_server"."IDX_e9ff04545263098241155f870b"
        `);
    await queryRunner.query(`
            DROP INDEX "replica_server"."IDX_4316150c3e1094e32e30aef76d"
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
            DROP TABLE "replica_server"."layer"
        `);
    await queryRunner.query(`
            DROP TYPE "replica_server"."layer_geometry_types_enum"
        `);
  }
}
