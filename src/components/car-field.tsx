"use client";

import { useEffect, useId, useState } from "react";
import { inputClass } from "./styles";

export function CarField({
  name = "carName",
  value,
  onValueChange,
}: {
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<string[]>([]);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 1) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/auta?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { cars: [] }))
        .then((body: { cars?: string[] }) => {
          setMatches((body.cars ?? []).filter((car) => car.toLowerCase() !== query.toLowerCase()));
        })
        .catch(() => {});
    }, 160);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  const visible = open && value.trim().length > 0 && matches.length > 0;

  return (
    <div className="relative">
      <input
        className={inputClass}
        name={name}
        value={value}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {visible ? (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-line bg-panel py-1 text-sm shadow-sm">
          {matches.map((car) => (
            <li key={car} role="option" aria-selected={false}>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left hover:bg-paper"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onValueChange(car);
                  setOpen(false);
                }}
              >
                {car}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
