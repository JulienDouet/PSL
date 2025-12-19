import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Twitch from "next-auth/providers/twitch";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
    Twitch({
      clientId: process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session: async ({ session, user }) => {
      if (session.user) {
        session.user.id = user.id;
        // Fetch additional user data
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { mmr: true, displayName: true, gamesPlayed: true },
        });
        if (dbUser) {
          (session.user as any).mmr = dbUser.mmr;
          (session.user as any).displayName = dbUser.displayName;
          (session.user as any).gamesPlayed = dbUser.gamesPlayed;
        }
      }
      return session;
    },
  },
  events: {
    createUser: async ({ user }) => {
      // Set displayName from name or email on first sign-in
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            displayName: user.name || user.email?.split("@")[0] || "Player",
          },
        });
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
