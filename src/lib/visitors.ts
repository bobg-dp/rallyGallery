import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { GUEST_ID } from "./guest-label";

type CountRow = { count: number };

export async function countGuests() {
  const rows = await getDb().execute<CountRow>(sql`select count(*)::int as count from guests`);
  return Number(rows[0]?.count ?? 0);
}

export async function rememberGuest(id: string) {
  if (!GUEST_ID.test(id)) return countGuests();
  await getDb().execute(sql`insert into guests (id) values (${id}::uuid) on conflict (id) do nothing`);
  return countGuests();
}
