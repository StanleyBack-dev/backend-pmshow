import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import type { SecretsPort } from "@/modules/identity/application/ports/secrets.port";

// No 0/O/1/l/I: temporary passwords are read off a screen or an e-mail.
const LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)];

// Fisher–Yates with a CSPRNG (sort() with a random comparator is biased).
function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

@Injectable()
export class NodeSecrets implements SecretsPort {
  private readonly key: string;

  constructor(config: ConfigService) {
    this.key = config.getOrThrow<string>("AUTH_HASH_SECRET");
  }

  randomToken(): string {
    return randomBytes(32).toString("base64url");
  }

  numericCode(digits: number): string {
    return randomInt(0, 10 ** digits)
      .toString()
      .padStart(digits, "0");
  }

  /** e.g. "Kp7m-Xz4q-9Rtw": three groups, always with letters and digits. */
  temporaryPassword(): string {
    const group = () => {
      const chars = [
        pick(LETTERS),
        pick(LETTERS),
        pick(DIGITS),
        pick(LETTERS + DIGITS),
      ];
      return shuffle(chars).join("");
    };
    return [group(), group(), group()].join("-");
  }

  digest(value: string): string {
    return createHmac("sha256", this.key).update(value).digest("hex");
  }

  sameDigest(a: string, b: string): boolean {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
