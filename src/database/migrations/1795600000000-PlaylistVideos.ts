import type { MigrationInterface, QueryRunner } from "typeorm";

// Playlists may also hold YouTube videos found while building them, kept in
// the playlist only (not songs of the repertoire): the songs table becomes
// the playlist's items, each one a song or a video.
export class PlaylistVideos1795600000000 implements MigrationInterface {
  name = "PlaylistVideos1795600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_playlist_songs" RENAME TO "tb_playlist_items"`,
    );
    await queryRunner.query(`
      ALTER TABLE "tb_playlist_items"
        ALTER COLUMN "idtb_songs" DROP NOT NULL,
        ADD COLUMN "youtube_video_id" varchar(11) NULL,
        ADD COLUMN "youtube_title" varchar(200) NULL,
        ADD COLUMN "youtube_channel" varchar(120) NULL,
        ADD CONSTRAINT "ck_playlist_items_song_or_video" CHECK (
          ("idtb_songs" IS NOT NULL AND "youtube_video_id" IS NULL
            AND "youtube_title" IS NULL AND "youtube_channel" IS NULL)
          OR ("idtb_songs" IS NULL AND "youtube_video_id" IS NOT NULL
            AND "youtube_title" IS NOT NULL)
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "tb_playlist_items" WHERE "idtb_songs" IS NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "tb_playlist_items"
        DROP CONSTRAINT IF EXISTS "ck_playlist_items_song_or_video",
        DROP COLUMN IF EXISTS "youtube_channel",
        DROP COLUMN IF EXISTS "youtube_title",
        DROP COLUMN IF EXISTS "youtube_video_id",
        ALTER COLUMN "idtb_songs" SET NOT NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "tb_playlist_items" RENAME TO "tb_playlist_songs"`,
    );
  }
}
