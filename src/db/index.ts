import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type AppDb = PostgresJsDatabase<typeof schema>;

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 10 });
  return { db: drizzle(sql, { schema }), sql };
}

const globalForDb = globalThis as unknown as {
  rallyDb?: ReturnType<typeof createDb>;
};

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (!globalForDb.rallyDb) globalForDb.rallyDb = createDb();
  else globalForDb.rallyDb.db = drizzle(globalForDb.rallyDb.sql, { schema });
  return globalForDb.rallyDb.db;
}
