import { slugify } from "./slug";

export type StartListRow = {
  line: number;
  startNumber: number;
  driver: string;
  codriver: string;
  className: string;
  car: string;
};

const fields = {
  "numer-startowy": "startNumber",
  numer: "startNumber",
  kierowca: "driver",
  pilot: "codriver",
  klasa: "className",
  samochod: "car",
  auto: "car",
} as const;

type Field = (typeof fields)[keyof typeof fields];

export function parseStartListCsv(text: string): { rows: StartListRow[] } | { error: string } {
  const table = splitCsv(text.replace(/^\uFEFF/, ""));
  const headerIndex = table.findIndex((row) => row.cells.some(Boolean));
  if (headerIndex < 0) return { error: "Plik jest pusty." };
  const header = table[headerIndex];
  const columns = new Map<Field, number>();
  header.cells.forEach((cell, index) => {
    const field = fields[slugify(cell) as keyof typeof fields];
    if (field && !columns.has(field)) columns.set(field, index);
  });
  const missing = (["startNumber", "driver", "className", "car"] as const).filter((field) => !columns.has(field));
  if (missing.length) {
    return { error: "W nagłówku brakuje kolumn: Numer Startowy, Kierowca, Klasa, Samochód." };
  }

  const rows: StartListRow[] = [];
  const seen = new Set<number>();
  for (const record of table.slice(headerIndex + 1)) {
    if (record.cells.every((cell) => !cell)) continue;
    const cell = (field: Field) => record.cells[columns.get(field) ?? -1]?.trim() ?? "";
    const startNumber = Number(cell("startNumber"));
    const driver = cell("driver").replace(/\s+/g, " ");
    const codriver = cell("codriver").replace(/\s+/g, " ");
    const className = cell("className").replace(/\s+/g, " ");
    const car = cell("car").replace(/\s+/g, " ");
    if (!Number.isInteger(startNumber) || startNumber < 1) {
      return { error: `Wiersz ${record.line}: numer startowy jest niepoprawny.` };
    }
    if (!driver || !className || !car) {
      return { error: `Wiersz ${record.line}: uzupełnij kierowcę, klasę i samochód.` };
    }
    if (driver.length > 120 || codriver.length > 120 || className.length > 80 || car.length > 120) {
      return { error: `Wiersz ${record.line}: któreś pole jest za długie.` };
    }
    if (seen.has(startNumber)) return { error: `Wiersz ${record.line}: numer ${startNumber} powtarza się w pliku.` };
    seen.add(startNumber);
    rows.push({ line: record.line, startNumber, driver, codriver, className, car });
  }
  if (!rows.length) return { error: "W pliku nie ma załóg." };
  if (rows.length > 500) return { error: "W pliku jest więcej niż 500 załóg." };
  return { rows };
}

function splitCsv(text: string) {
  const table: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  const pushField = () => {
    cells.push(field.trim());
    field = "";
  };
  const pushRow = () => {
    pushField();
    table.push({ line, cells });
    cells = [];
    line += 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ";") pushField();
    else if (char === "\n") pushRow();
    else if (char !== "\r") field += char;
  }
  if (field.length || cells.length) pushRow();
  return table;
}
