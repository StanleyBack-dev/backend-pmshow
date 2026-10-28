import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { In, type DataSource, type EntityManager } from "typeorm";
import type {
  NewPlaylist,
  PlaylistRepositoryPort,
  PlaylistView,
} from "@/modules/playlists/application/ports/playlist-repository.port";
import type { Playlist } from "@/modules/playlists/domain/playlist";
import {
  PlaylistOrmEntity,
  PlaylistSongOrmEntity,
} from "@/modules/playlists/infrastructure/persistence/typeorm/playlist.orm-entity";

type PlaylistRow = PlaylistOrmEntity & { ownerName: string };

@Injectable()
export class PlaylistTypeormRepository implements PlaylistRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listVisible(userId: string): Promise<PlaylistView[]> {
    return this.query(
      "WHERE p.owner_id = $1 OR p.shared",
      [userId],
      "ORDER BY (p.owner_id = $1) DESC, p.updated_at DESC",
    );
  }

  async findById(id: string): Promise<PlaylistView | null> {
    const [found] = await this.query("WHERE p.idtb_playlists = $1", [id]);
    return found ?? null;
  }

  async create(playlist: NewPlaylist): Promise<PlaylistView> {
    const id = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PlaylistOrmEntity);
      const saved = await repository.save(
        repository.create({
          ownerId: playlist.ownerId,
          name: playlist.name,
          description: playlist.description,
          shared: playlist.shared,
        }),
      );
      await this.writeSongs(manager, saved.id, playlist.songIds);
      return saved.id;
    });
    return this.mustFind(id);
  }

  async update(
    id: string,
    data: Pick<Playlist, "name" | "description" | "shared" | "songIds">,
  ): Promise<PlaylistView> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(PlaylistOrmEntity).update(
        { id },
        {
          name: data.name,
          description: data.description,
          shared: data.shared,
          updatedAt: new Date(),
        },
      );
      await manager.getRepository(PlaylistSongOrmEntity).delete({
        playlistId: id,
      });
      await this.writeSongs(manager, id, data.songIds);
    });
    return this.mustFind(id);
  }

  async delete(id: string): Promise<void> {
    await this.dataSource.getRepository(PlaylistOrmEntity).delete({ id });
  }

  private async writeSongs(
    manager: EntityManager,
    playlistId: string,
    songIds: readonly string[],
  ): Promise<void> {
    if (songIds.length === 0) return;
    await manager.getRepository(PlaylistSongOrmEntity).insert(
      songIds.map((songId, index) => ({
        playlistId,
        songId,
        position: index + 1,
      })),
    );
  }

  // The owner's name comes from tb_users (identity), read-only; the songs in
  // one query for every playlist listed.
  private async query(
    where: string,
    params: unknown[],
    order = "ORDER BY p.updated_at DESC",
  ): Promise<PlaylistView[]> {
    const rows = await this.dataSource.query<PlaylistRow[]>(
      `SELECT p.idtb_playlists AS id, p.owner_id AS "ownerId", p.name,
              p.description, p.shared, p.created_at AS "createdAt",
              p.updated_at AS "updatedAt", u.name AS "ownerName"
         FROM tb_playlists p
         JOIN tb_users u ON u.idtb_users = p.owner_id
         ${where}
         ${order}`,
      params,
    );
    if (rows.length === 0) return [];
    const songs = await this.dataSource
      .getRepository(PlaylistSongOrmEntity)
      .find({
        where: { playlistId: In(rows.map((row) => row.id)) },
        order: { position: "ASC" },
      });
    return rows.map((row) => ({
      ...row,
      songIds: songs
        .filter((song) => song.playlistId === row.id)
        .map((song) => song.songId),
    }));
  }

  private async mustFind(id: string): Promise<PlaylistView> {
    const found = await this.findById(id);
    if (!found) throw new Error(`Playlist ${id} vanished`);
    return found;
  }
}
