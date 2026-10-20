"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { auth, signIn, signOut } from "@/auth";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import type { FormState } from "@/lib/form";
import { normalizeLogin } from "@/lib/login";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: normalizeLogin(String(formData.get("login") ?? "")),
      password: formData.get("password"),
      redirectTo: "/studio",
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Nieprawidłowy login albo hasło." };
    throw error;
  }
  return {};
}

export async function logout() {
  const session = await auth();
  if (session?.user?.sessionId) {
    await getDb().delete(sessions).where(eq(sessions.id, session.user.sessionId));
  }
  await signOut({ redirectTo: "/" });
}
