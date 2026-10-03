import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/masareefy.db";

// لو قاعدة البيانات ملف محلي، نتأكد إن المجلد موجود قبل الاتصال
if (url.startsWith("file:")) {
  const filePath = url.slice("file:".length).split("?")[0];
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  try {
    mkdirSync(path.dirname(absolute), { recursive: true });
  } catch {
    // المجلد موجود بالفعل أو مفيش صلاحية
  }
}

const globalForDb = globalThis as unknown as {
  __masareefyClient?: Client;
  __masareefyDb?: LibSQLDatabase<typeof schema>;
};

export const client: Client =
  globalForDb.__masareefyClient ??
  createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

export const db: LibSQLDatabase<typeof schema> = globalForDb.__masareefyDb ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__masareefyClient = client;
  globalForDb.__masareefyDb = db;
}

export { schema };