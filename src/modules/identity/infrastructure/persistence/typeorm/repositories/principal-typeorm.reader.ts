import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  Principal,
  PrincipalReaderPort,
} from "@/modules/identity/application/ports/principal-reader.port";

type PrincipalRow = {
  session_id: string;
  revoked_at: Date | null;
  expires_at: Date;
  user_id: string;
  name: string;
  username: string;
  email: string;
  group: Principal["group"];
  active: boolean;
  must_change_password: boolean;
};

@Injectable()
export class PrincipalTypeormReader implements PrincipalReaderPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findBySession(sessionId: string): Promise<Principal | null> {
    const rows: PrincipalRow[] = await this.dataSource.query(
      `SELECT s.idtb_sessions AS session_id, s.revoked_at, s.expires_at,
              u.idtb_users AS user_id, u.name, u.username, u.email, u."group",
              u.active, c.must_change_password
         FROM tb_sessions s
         JOIN tb_users u ON u.idtb_users = s.idtb_users
         JOIN tb_auth_credentials c ON c.idtb_users = u.idtb_users
        WHERE s.idtb_sessions = $1`,
      [sessionId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      sessionId: row.session_id,
      sessionRevokedAt: row.revoked_at,
      sessionExpiresAt: row.expires_at,
      userId: row.user_id,
      name: row.name,
      username: row.username,
      email: row.email,
      group: row.group,
      active: row.active,
      mustChangePassword: row.must_change_password,
    };
  }
}
