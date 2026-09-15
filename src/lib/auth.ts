import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Simple credentials-based auth for the two full-access users (Ryan, Alina).
// No OAuth providers needed today, so we skip the Prisma adapter and use the
// default JWT session strategy — plain, and easy to extend with more users
// (e.g. scoped roles for an outsourced PM company) later.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true, // required off Vercel (Railway/Render) unless AUTH_TRUST_HOST=true is set
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = (user as { role?: string }).role ?? "admin";
        token.id = user.id;
        // Baked into the JWT at login — a password change forces a fresh
        // sign-in (see changePassword in lib/actions/account.ts) rather
        // than trying to mutate an already-issued token in place.
        token.mustChangePassword = (
          user as { mustChangePassword?: boolean }
        ).mustChangePassword ?? false;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        const sessionUser = session.user as typeof session.user & {
          role: string;
          mustChangePassword: boolean;
        };
        sessionUser.role = (token.role as string) ?? "admin";
        sessionUser.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
});
