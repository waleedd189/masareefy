import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/masareefy.db";

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
