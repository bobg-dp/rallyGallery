import { and, eq } from "drizzle-orm";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor";
  sessionId: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  await connection();
  const session = await auth();
  const sessionId = session?.user?.sessionId;
  const userId = session?.user?.id;
  if (!sessionId || !userId) return null;

  const row = await getDb().query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
    with: { user: true },
  });
  if (!row || row.expiresAt.getTime() < Date.now() || row.user.disabledAt) return null;
  return {
    id: row.user.id,
    email: row.user.email,
    name: row.user.name,
    role: row.user.role,
    sessionId,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/studio");
  return user;
}
