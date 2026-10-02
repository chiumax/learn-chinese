import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "@/lib/env";
import { isOwnerEmail } from "@/lib/authz";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    signIn({ account, profile }) {
      return (
        account?.provider === "google" &&
        profile?.email_verified === true &&
        isOwnerEmail(profile.email, env.AUTH_OWNER_EMAILS)
      );
    },
    authorized({ auth: session, request }) {
      const allowed = isOwnerEmail(session?.user?.email, env.AUTH_OWNER_EMAILS);
      if (!allowed && request.nextUrl.pathname.startsWith("/api/")) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      return allowed;
    },
  },
});
