import type { MigrationInterface, QueryRunner } from "typeorm";

// The venue address in parts (CEP, street, number, complement, district,
// city, UF). The old free-text address is kept as the street.
export class VenueAddressParts1793900000000 implements MigrationInterface {
  name = "VenueAddressParts1793900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tb_venues
        ADD COLUMN zip_code varchar(8),
        ADD COLUMN street varchar(160),
        ADD COLUMN number varchar(10),
        ADD COLUMN complement varchar(80),
        ADD COLUMN district varchar(80),
        ADD COLUMN state varchar(2) NOT NULL DEFAULT 'GO',
        ADD CONSTRAINT ck_venues_zip_code CHECK (zip_code ~ '^[0-9]{8}$'),
        ADD CONSTRAINT ck_venues_state CHECK (state ~ '^[A-Z]{2}$')
    `);
    await queryRunner.query(
      `UPDATE tb_venues SET street = left(address, 160) WHERE address IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE tb_venues DROP COLUMN address`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tb_venues ADD COLUMN address varchar(255)`,
    );
    await queryRunner.query(`
      UPDATE tb_venues SET address = nullif(concat_ws(', ',
        street, number, complement, district), '')
    `);
    await queryRunner.query(`
      ALTER TABLE tb_venues
        DROP CONSTRAINT ck_venues_zip_code,
        DROP CONSTRAINT ck_venues_state,
        DROP COLUMN zip_code,
        DROP COLUMN street,
        DROP COLUMN number,
        DROP COLUMN complement,
        DROP COLUMN district,
        DROP COLUMN state
    `);
  }
}
