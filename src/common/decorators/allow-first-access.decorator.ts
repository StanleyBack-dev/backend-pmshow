import { SetMetadata } from "@nestjs/common";

// Operations still reachable while the user must replace the temporary
// password (me, change password, logout). Everything else is blocked by the
// first-access guard until then.
export const ALLOW_FIRST_ACCESS_KEY = "allowFirstAccess";
export const AllowFirstAccess = () => SetMetadata(ALLOW_FIRST_ACCESS_KEY, true);
