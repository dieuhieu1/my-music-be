import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase9Reports1714000002000 implements MigrationInterface {
  name = 'Phase9Reports1714000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── reports table (BL-38) ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reports" (
        "id"              uuid        NOT NULL DEFAULT gen_random_uuid(),
        "reporter_id"     uuid        NOT NULL,
        "target_type"     varchar(20) NOT NULL,
        "target_id"       uuid        NOT NULL,
        "reason"          varchar(30) NOT NULL,
        "status"          varchar(20) NOT NULL DEFAULT 'PENDING',
        "notes"           text,
        "resolved_by_id"  uuid,
        "resolved_at"     timestamptz,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_reports" PRIMARY KEY ("id"),
        CONSTRAINT "fk_reports_reporter"
          FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_reports_resolver"
          FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "uq_reports_reporter_target"
          UNIQUE ("reporter_id", "target_type", "target_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_status"      ON "reports" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_target_type" ON "reports" ("target_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_reports_reporter"    ON "reports" ("reporter_id")`,
    );

    // ── play_history analytics indexes (BL-51) ───────────────────────────────
    // Required for GROUP BY queries in AnalyticsService; flag in Phase 9 gaps if missing
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_play_history_song_played_at"
       ON "play_history" ("song_id", "played_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_play_history_user_played_at"
       ON "play_history" ("user_id", "played_at")`,
    );

    // ── payment_records: make premium_type nullable for custom-duration grants ─
    // (admin can grant arbitrary durationDays; not mappable to a fixed PremiumType)
    await queryRunner.query(
      `ALTER TABLE "payment_records" ALTER COLUMN "premium_type" DROP NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_records" ALTER COLUMN "premium_type" SET NOT NULL`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_play_history_user_played_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_play_history_song_played_at"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reports_reporter"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reports_target_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reports_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reports"`);
  }
}
