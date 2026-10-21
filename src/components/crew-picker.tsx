"use client";

import { spectatorsCrew } from "@/lib/query";
import { SelectInput } from "./field";

export type CrewOption = {
  id: string;
  startNumber: string;
  className: string;
  car: string;
  driverName: string;
  codriverName: string | null;
  competitionName: string | null;
};

const MAX_CREWS = 30;

export function crewOptionLabel(crew: CrewOption) {
  const names = [crew.driverName, crew.codriverName].filter(Boolean).join(" / ");
  return `${crew.startNumber} ${names}${crew.competitionName ? ` · ${crew.competitionName}` : ""}`;
}

export function CrewPicker({
  crews,
  crewIds,
  spectators,
  unchanged = false,
  allowUnchanged = false,
  onChange,
}: {
  crews: CrewOption[];
  crewIds: string[];
  spectators: boolean;
  unchanged?: boolean;
  allowUnchanged?: boolean;
  onChange: (next: { crewIds: string[]; spectators: boolean; unchanged: boolean; added: CrewOption | null }) => void;
}) {
  const selected = crewIds
    .map((id) => crews.find((crew) => crew.id === id))
    .filter((crew): crew is CrewOption => Boolean(crew));
  const selectedIds = new Set(selected.map((crew) => crew.id));
  const available = crews.filter((crew) => !selectedIds.has(crew.id));

  function choose(value: string) {
    if (!value) return;
    if (value === "keep") {
      onChange({ crewIds: [], spectators: false, unchanged: true, added: null });
      return;
    }
    if (value === "clear") {
      onChange({ crewIds: [], spectators: false, unchanged: false, added: null });
      return;
    }
    if (value === spectatorsCrew) {
      onChange({ crewIds: [], spectators: true, unchanged: false, added: null });
      return;
    }
    const crew = crews.find((item) => item.id === value);
    if (!crew || selectedIds.has(crew.id) || selected.length >= MAX_CREWS) return;
    onChange({ crewIds: [...crewIds, crew.id], spectators: false, unchanged: false, added: crew });
  }

  return (
    <div className="space-y-2">
      {unchanged ? null : (
        <div className="flex flex-wrap gap-1.5">
          {spectators ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-1 text-xs">
              Kibice
              <button type="button" className="px-1 text-muted" aria-label="Usuń kibiców" onClick={() => onChange({ crewIds: [], spectators: false, unchanged: false, added: null })}>
                ×
              </button>
            </span>
          ) : (
            selected.map((crew) => (
              <span key={crew.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-1 text-xs">
                {crew.startNumber} {crew.driverName}
                <button
                  type="button"
                  className="px-1 text-muted"
                  aria-label={`Usuń numer ${crew.startNumber}`}
                  onClick={() => onChange({ crewIds: crewIds.filter((id) => id !== crew.id), spectators: false, unchanged: false, added: null })}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      )}
      <SelectInput value="" onChange={(event) => choose(event.target.value)}>
        <option value="">{unchanged ? "Bez zmian" : "Dodaj zawodnika"}</option>
        {allowUnchanged && !unchanged ? <option value="keep">Bez zmian</option> : null}
        {allowUnchanged && !unchanged ? <option value="clear">Usuń zawodników</option> : null}
        {spectators ? null : <option value={spectatorsCrew}>Kibice</option>}
        {available.map((crew) => (
          <option key={crew.id} value={crew.id}>
            {crewOptionLabel(crew)}
          </option>
        ))}
      </SelectInput>
      {unchanged ? null : spectators ? (
        <input type="hidden" name="spectators" value="1" />
      ) : (
        selected.map((crew) => <input key={crew.id} type="hidden" name="crewEntryId" value={crew.id} />)
      )}
      {allowUnchanged ? <input type="hidden" name="crewMode" value={unchanged ? "" : spectators || selected.length ? "set" : "clear"} /> : null}
      <p className="text-xs text-muted">Możesz dodać kilka numerów. Auto uzupełni się z wybranego zawodnika.</p>
    </div>
  );
}
