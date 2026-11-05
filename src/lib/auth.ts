import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { normalizeKenyanPhone } from "./phone";
import { rateLimit, RateLimitError } from "./rate-limit";

declare module "next-auth" {
  interface Session {
    user: { id: string; name: string; email: string; role: Role };
  }
  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

let _dummy: string | null = null;
const dummyHash = () => (_dummy ??= bcrypt.hashSync("not-a-real-password", 12));

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email or phone",
      credentials: {
        identifier: { label: "Email or phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const identifier = credentials?.identifier?.trim().toLowerCase() ?? "";
        const password = credentials?.password ?? "";
        if (!identifier || !password) return null;

        const fwd = req?.headers?.["x-forwarded-for"];
        const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || "unknown";
        try {
          await rateLimit(`login:ip:${ip}`, 30, 15 * 60);
          await rateLimit(`login:id:${identifier}`, 8, 15 * 60);
        } catch (e) {
          if (e instanceof RateLimitError) throw new Error(e.message);
          throw e;
        }

        const phone = normalizeKenyanPhone(identifier);
        const user = await db.user.findFirst({
          where: phone ? { OR: [{ email: identifier }, { phone }] } : { email: identifier },
        });
        // Always run bcrypt to avoid user-enumeration timing differences.
        const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash());
        if (!user || !ok) return null;
        if (user.status === "SUSPENDED") throw new Error("Your account has been suspended. Contact support.");
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = { id: token.id, name: token.name ?? "", email: token.email ?? "", role: token.role };
      return session;
    },
  },
};
