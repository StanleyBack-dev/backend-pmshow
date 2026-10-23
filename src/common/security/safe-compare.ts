import { createHash, timingSafeEqual } from "crypto";

// Constant-time comparison that also hides length differences (both sides
// are hashed to a fixed size first).
export function safeCompare(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}
