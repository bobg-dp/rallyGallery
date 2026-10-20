import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { isLogin, normalizeLogin } from "@/lib/login";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "editor";
      sessionId: string;
    } & import("next-auth").DefaultSession["user"];
  }

  interface User {
    role: "admin" | "editor";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Login", type: "text" },
        password: { label: "Hasło", type: "password" },
      },
      authorize: async (credentials) => {
        const email = normalizeLogin(String(credentials.email ?? ""));
        const password = String(credentials.password ?? "");
        if (!isLogin(email) || !password) return null;
        const user = await getDb().query.users.findFirst({ where: eq(users.email, email) });
        if (!user || user.disabledAt) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000);
        await getDb().insert(sessions).values({ id: sessionId, userId: user.id!, expiresAt });
        token.sessionId = sessionId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = token.role === "admin" || token.role === "editor" ? token.role : "editor";
      session.user.sessionId = typeof token.sessionId === "string" ? token.sessionId : "";
      return session;
    },
  },
});
