import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity("tb_calendar_feeds")
export class CalendarFeedOrmEntity {
  @PrimaryColumn({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 64, unique: true })
  token!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
