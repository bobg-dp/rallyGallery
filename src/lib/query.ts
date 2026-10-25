export const spectatorsCrew = "kibice";

export type PublicQuery = {
  view: "all" | "latest" | "galleries";
  display: "grid" | "map";
  sort: "stage" | "crew" | "author";
  stage?: string;
  q?: string;
  className?: string;
  car?: string;
  competition?: string;
  author?: string;
  crew?: string;
  photo?: string;
};

export function parsePublicQuery(searchParams: Record<string, string | string[] | undefined>): PublicQuery {
  const one = (key: string) => {
    const value = searchParams[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
  };
  const view = one("view");
  const display = one("display");
  const sort = one("sort");
  return {
    view: view === "latest" || view === "galleries" ? view : "all",
    display: display === "map" ? display : "grid",
    sort: sort === "crew" || sort === "author" ? sort : "stage",
    stage: one("stage"),
    q: one("q"),
    className: one("klasa"),
    car: one("auto"),
    competition: one("typ"),
    author: one("author"),
    crew: one("crew"),
    photo: one("photo"),
  };
}

export function withQuery(path: string, query: PublicQuery, patch: Partial<PublicQuery> = {}) {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.view !== "all") params.set("view", next.view);
  if (next.display !== "grid") params.set("display", next.display);
  if (next.sort !== "stage") params.set("sort", next.sort);
  if (next.stage) params.set("stage", next.stage);
  if (next.q) params.set("q", next.q);
  if (next.className) params.set("klasa", next.className);
  if (next.car) params.set("auto", next.car);
  if (next.competition) params.set("typ", next.competition);
  if (next.author) params.set("author", next.author);
  if (next.crew) params.set("crew", next.crew);
  if (next.photo) params.set("photo", next.photo);
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export function clearedFilters(path: string, query: PublicQuery) {
  return withQuery(path, query, {
    q: undefined,
    crew: undefined,
    stage: undefined,
    className: undefined,
    car: undefined,
    author: undefined,
    competition: undefined,
    photo: undefined,
    sort: "stage",
  });
}
