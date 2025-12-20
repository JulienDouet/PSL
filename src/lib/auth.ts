import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: false, // We only use social login
  },
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    },
    twitch: {
      clientId: process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every day
  },
  user: {
    additionalFields: {
      displayName: {
        type: "string",
        required: false,
      },
      mmr: {
        type: "number",
        required: false,
        defaultValue: 1000,
      },
      gamesPlayed: {
        type: "number",
        required: false,
        defaultValue: 0,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
