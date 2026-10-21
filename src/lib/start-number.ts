import { sql, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

const START_NUMBER = /^[\p{L}\p{N}-]+$/u;

export function normalizeStartNumber(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function startNumberKey(value: string) {
  return normalizeStartNumber(value).toLocaleLowerCase("pl");
}

export function startNumberError(value: string) {
  if (!value) return "Podaj numer startowy.";
  if (value.length > 20) return "Numer startowy jest za długi.";
  if (!START_NUMBER.test(value)) return "Numer startowy może zawierać litery, cyfry i myślnik.";
  return null;
}

export function startNumberOrder(column: AnyColumn | SQL): SQL[] {
  const leading = sql`substring(${column} from '^[0-9]{1,9}')`;
  return [
    sql`case when ${leading} is null then 1 else 0 end`,
    sql`case when ${leading} is null then 0 else ${leading}::integer end`,
    sql`lower(${column})`,
  ];
}
