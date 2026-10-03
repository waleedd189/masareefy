/** يشتغل مرة واحدة عند بدء السيرفر – بيطبّق الـ migrations تلقائياً */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrations } = await import("./db/migrate");
  try {
    await runMigrations();
    console.log("[masareefy] قاعدة البيانات جاهزة");
  } catch (error) {
    console.error("[masareefy] فشل تطبيق migrations:", error);
  }
}
