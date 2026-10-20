import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { WorkspaceHeader } from "@/components/workspace-header";
import { requireUser } from "@/lib/current-user";

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceHeader name={user.name} admin={user.role === "admin"} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Wczytuję biurko…</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
