import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { In, type DataSource, type EntityManager } from "typeorm";
import type {
  NewPlaylist,
  PlaylistRepositoryPort,
  PlaylistView,
} from "@/modules/playlists/application/ports/playlist-repository.port";
import type {
  Playlist,
  PlaylistItem,
} from "@/modules/playlists/domain/playlist";
import {
  PlaylistItemOrmEntity,
  PlaylistOrmEntity,
} from "@/modules/playlists/infrastructure/persistence/typeorm/playlist.orm-entity";

type PlaylistRow = PlaylistOrmEntity & { ownerName: string };

const toItem = (row: PlaylistItemOrmEntity): PlaylistItem =>
  row.songId
    ? { kind: "song", songId: row.songId }
    : {
        kind: "video",
        video: {
          videoId: row.videoId ?? "",
          title: row.videoTitle ?? "",
          channelTitle: row.videoChannel,
        },
      };

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
      await this.writeItems(manager, saved.id, playlist.items);
      return saved.id;
    });
    return this.mustFind(id);
  }

  async update(
    id: string,
    data: Pick<Playlist, "name" | "description" | "shared" | "items">,
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
      await manager.getRepository(PlaylistItemOrmEntity).delete({
        playlistId: id,
      });
      await this.writeItems(manager, id, data.items);
    });
    return this.mustFind(id);
  }

  async delete(id: string): Promise<void> {
    await this.dataSource.getRepository(PlaylistOrmEntity).delete({ id });
  }

  private async writeItems(
    manager: EntityManager,
    playlistId: string,
    items: readonly PlaylistItem[],
  ): Promise<void> {
    if (items.length === 0) return;
    await manager.getRepository(PlaylistItemOrmEntity).insert(
      items.map((item, index) => ({
        playlistId,
        position: index + 1,
        songId: item.kind === "song" ? item.songId : null,
        videoId: item.kind === "video" ? item.video.videoId : null,
        videoTitle: item.kind === "video" ? item.video.title : null,
        videoChannel: item.kind === "video" ? item.video.channelTitle : null,
      })),
    );
  }

  // The owner's name comes from tb_users (identity), read-only; the items in
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
    const items = await this.dataSource
      .getRepository(PlaylistItemOrmEntity)
      .find({
        where: { playlistId: In(rows.map((row) => row.id)) },
        order: { position: "ASC" },
      });
    return rows.map((row) => ({
      ...row,
      items: items.filter((item) => item.playlistId === row.id).map(toItem),
    }));
  }

  private async mustFind(id: string): Promise<PlaylistView> {
    const found = await this.findById(id);
    if (!found) throw new Error(`Playlist ${id} vanished`);
    return found;
  }
}
