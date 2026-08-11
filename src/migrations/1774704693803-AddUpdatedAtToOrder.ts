import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUpdatedAtToOrder1774704693803 implements MigrationInterface {
    name = 'AddUpdatedAtToOrder1774704693803'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "updatedAt"`);
    }

}
