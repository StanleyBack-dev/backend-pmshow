// Who created a record and who changed it last, kept in the record's own
// table (created_by / created_at / updated_by / updated_at) instead of a
// separate, ever-growing log.

/** The tables that carry stamps, by the name the API and the UI use. */
export const STAMPED_TABLES = {
  user: { table: "tb_users", key: "idtb_users" },
  member: { table: "tb_members", key: "idtb_users" },
  song: { table: "tb_songs", key: "idtb_songs" },
  artist: { table: "tb_artists", key: "idtb_artists" },
  event: { table: "tb_events", key: "idtb_events" },
  venue: { table: "tb_venues", key: "idtb_venues" },
  instrument: { table: "tb_instruments", key: "idtb_instruments" },
  band_function: { table: "tb_band_functions", key: "idtb_band_functions" },
  duty_schedule: { table: "tb_duty_schedules", key: "idtb_duty_schedules" },
  absence: { table: "tb_absences", key: "idtb_absences" },
  broadcast: { table: "tb_broadcasts", key: "idtb_broadcasts" },
  roster: { table: "tb_rosters", key: "idtb_events" },
  media: { table: "tb_media_assets", key: "idtb_media_assets" },
  enrollment_invite: {
    table: "tb_enrollment_invites",
    key: "idtb_enrollment_invites",
  },
  enrollment_request: {
    table: "tb_enrollment_requests",
    key: "idtb_enrollment_requests",
  },
} as const;

export type StampedEntity = keyof typeof STAMPED_TABLES;

export const isStampedEntity = (value: string): value is StampedEntity =>
  Object.hasOwn(STAMPED_TABLES, value);

export type StampInput = {
  /** Who did it (null: the system). */
  actorId: string | null;
  entity: StampedEntity;
  entityId: string;
  /** The record was just created: also fills created_by. */
  created?: boolean;
};

export type RecordStamp = {
  createdAt: Date;
  createdById: string | null;
  createdByName: string | null;
  updatedAt: Date;
  updatedById: string | null;
  updatedByName: string | null;
};
