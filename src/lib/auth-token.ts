import { createHash } from "node:crypto";

/**
 * تجزئة مفاتيح الـAPI ببصمة SHA-256.
 *
 * بدل تخزين المفتاح صريح في قاعدة البيانات (زي ما كان حاصل)، بنخزّن البصمة بس
 * — نفس فكرة `KeystoreFieldCipher` في Mezanetak (الحقول الحساسة مش بتتخزن مقروءة).
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}
