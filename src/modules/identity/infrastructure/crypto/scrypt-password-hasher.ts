import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { PasswordHasherPort } from "@/modules/identity/application/ports/password-hasher.port";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

// "<salt hex>:<derived key hex>" — same format as royal-copeiras/vaulto.
@Injectable()
export class ScryptPasswordHasher implements PasswordHasherPort {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const key = await scrypt(password, salt, KEY_LENGTH);
    return `${salt}:${key.toString("hex")}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [salt, keyHex] = stored.split(":");
    if (!salt || !keyHex) return false;
    const expected = Buffer.from(keyHex, "hex");
    const actual = await scrypt(password, salt, KEY_LENGTH);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }
}
