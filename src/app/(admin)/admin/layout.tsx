import { Suspense } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { WorkspaceHeader } from "@/components/workspace-header";
import { requireAdmin } from "@/lib/current-user";

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceHeader name={user.name} admin />
      <div className="border-b border-line">
        <nav className="mx-auto flex max-w-6xl gap-4 px-4 py-3 text-sm">
          <Link href="/admin">Start</Link>
          <Link href="/admin/uzytkownicy">Konta</Link>
          <Link href="/admin/cykle">Cykle</Link>
          <Link href="/admin/rajdy">Rajdy</Link>
          <Link href="/admin/autorzy">Autorzy</Link>
        </nav>
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Wczytuję administrację…</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
