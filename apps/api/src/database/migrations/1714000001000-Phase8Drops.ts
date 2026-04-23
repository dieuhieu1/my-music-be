import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase8Drops1714000001000 implements MigrationInterface {
  name = 'Phase8Drops1714000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── songs: drop scheduling columns (BL-59, BL-65) ────────────────────────
    await queryRunner.query(
      `ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "drop_job_24h_id" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "drop_job_1h_id" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "has_rescheduled" boolean NOT NULL DEFAULT false`,
    );
    // Cron query: WHERE status = 'SCHEDULED' AND drop_at <= NOW()
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_songs_status_drop_at" ON "songs" ("status", "drop_at")`,
    );

    // ── notifications: title + body columns (BL-80) ───────────────────────────
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "body" text NOT NULL DEFAULT ''`,
    );
    // Unread-count query: WHERE user_id = ? AND is_read = false
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_user_is_read" ON "notifications" ("user_id", "is_read")`,
    );

    // ── drop_notifications: opt-in table (BL-64) ─────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "drop_notifications" (
        "user_id"    uuid        NOT NULL,
        "song_id"    uuid        NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_drop_notifications"
          PRIMARY KEY ("user_id", "song_id"),
        CONSTRAINT "fk_drop_notif_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_drop_notif_song"
          FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_drop_notifications_song" ON "drop_notifications" ("song_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_drop_notifications_song"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drop_notifications"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_user_is_read"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "body"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "title"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_songs_status_drop_at"`);
    await queryRunner.query(`ALTER TABLE "songs" DROP COLUMN IF EXISTS "has_rescheduled"`);
    await queryRunner.query(`ALTER TABLE "songs" DROP COLUMN IF EXISTS "drop_job_1h_id"`);
    await queryRunner.query(`ALTER TABLE "songs" DROP COLUMN IF EXISTS "drop_job_24h_id"`);
  }
}
