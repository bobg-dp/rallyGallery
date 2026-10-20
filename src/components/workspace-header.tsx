import Link from "next/link";
import { logout } from "@/app/login/actions";
import { btnGhost } from "./styles";

export function WorkspaceHeader({
  name,
  admin,
}: {
  name: string;
  admin: boolean;
}) {
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4">
        <Link href="/" className="font-display text-xl tracking-tight">
          Galeria rajdowa
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/studio">Biurko</Link>
          <Link href="/studio/nowa">Nowa paczka</Link>
          {admin ? <Link href="/admin">Administracja</Link> : null}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-muted">{name}</span>
          <form action={logout}>
            <button className={btnGhost} type="submit">
              Wyloguj
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
