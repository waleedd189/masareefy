import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client";

let done: Promise<void> | null = null;

/** تطبيق الـ migrations (مرة واحدة لكل عملية تشغيل) */
export function runMigrations(): Promise<void> {
  if (!done) {
    done = migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") }).catch((error) => {
      done = null;
      throw error;
    });
  }
  return done;
}
