import type { MigrationInterface, QueryRunner } from "typeorm";

const UNIFORMS = [
  "OPERACIONAL_4A",
  "OPERACIONAL_4B",
  "OPERACIONAL_4C",
  "TUNICA",
  "SOCIAL",
  "PAISANO",
];
const LIST = UNIFORMS.map((value) => `'${value}'`).join(", ");

// The event uniform becomes a fixed list (PMGO uniforms or paisano). Free
// text typed before is kept in the notes, so nothing is lost; those events
// get a uniform from the list on their next edit.
export class EventUniformList1794000000000 implements MigrationInterface {
  name = "EventUniformList1794000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tb_events
         SET notes = left(concat_ws(E'\\n', notes, 'Uniforme: ' || uniform), 2000),
             uniform = NULL
       WHERE uniform IS NOT NULL AND uniform NOT IN (${LIST})
    `);
    await queryRunner.query(`
      ALTER TABLE tb_events
        ALTER COLUMN uniform TYPE varchar(20),
        ADD CONSTRAINT ck_events_uniform CHECK (uniform IN (${LIST}))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tb_events
        DROP CONSTRAINT ck_events_uniform,
        ALTER COLUMN uniform TYPE varchar(160)
    `);
  }
}
