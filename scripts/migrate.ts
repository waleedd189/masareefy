import { runMigrations } from "../src/db/migrate";

runMigrations()
  .then(() => {
    console.log("✅ تم تطبيق الـ migrations");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ فشل تطبيق الـ migrations:", error);
    process.exit(1);
  });
