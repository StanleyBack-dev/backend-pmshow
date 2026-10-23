import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import {
  PASSWORD_HASHER,
  type PasswordHasherPort,
} from "@/modules/identity/application/ports/password-hasher.port";
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import { checkPassword } from "@/modules/identity/domain/password-policy";
import {
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
} from "@/modules/identity/domain/username";

// Creates the first ADMIN_MASTER from BOOTSTRAP_ADMIN_MASTER_* when the
// database has none (royal-copeiras pattern). Never fails the boot: a bad
// configuration is logged and skipped. Turn it off once the admin exists.
@Injectable()
export class BootstrapAdminMasterUseCase {
  private readonly logger = new Logger(BootstrapAdminMasterUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    private readonly config: ConfigService,
  ) {}

  async execute(): Promise<void> {
    if (this.config.get<boolean>("BOOTSTRAP_ADMIN_MASTER_ENABLED") !== true) {
      return;
    }
    if ((await this.users.countActiveInGroup(UserGroup.ADMIN_MASTER)) > 0) {
      return;
    }

    const name = this.config.get<string>("BOOTSTRAP_ADMIN_MASTER_NAME")?.trim();
    const email = normalizeEmail(
      this.config.get<string>("BOOTSTRAP_ADMIN_MASTER_EMAIL") ?? "",
    );
    const username = normalizeUsername(
      this.config.get<string>("BOOTSTRAP_ADMIN_MASTER_USERNAME") ?? "",
    );
    const password =
      this.config.get<string>("BOOTSTRAP_ADMIN_MASTER_PASSWORD") ?? "";

    if (!name || !email.includes("@") || !isValidUsername(username)) {
      this.logger.error(
        "Bootstrap do ADMIN_MASTER ignorado: defina BOOTSTRAP_ADMIN_MASTER_NAME, _EMAIL e _USERNAME válidos.",
      );
      return;
    }
    const violations = checkPassword(password, { username });
    if (violations.length > 0) {
      this.logger.error(
        `Bootstrap do ADMIN_MASTER ignorado: BOOTSTRAP_ADMIN_MASTER_PASSWORD fraca (${violations.join(", ")}).`,
      );
      return;
    }
    if (
      (await this.users.findByUsername(username)) ||
      (await this.users.findByEmail(email))
    ) {
      this.logger.error(
        "Bootstrap do ADMIN_MASTER ignorado: usuário ou e-mail já cadastrado com outro grupo.",
      );
      return;
    }

    await this.users.createWithCredential(
      { name, email, username, group: UserGroup.ADMIN_MASTER },
      // The password came from the operator's env, not from a reset: no
      // forced change, so the first login lands straight in the app.
      {
        passwordHash: await this.hasher.hash(password),
        mustChangePassword: false,
      },
    );
    this.logger.warn(
      `ADMIN_MASTER inicial "${username}" criado. Defina BOOTSTRAP_ADMIN_MASTER_ENABLED=false.`,
    );
  }
}
