import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { VaultRole } from "@prisma/client";
import { prisma } from "@/db/client";
import { sendMagicLinkEmail } from "@/services/email";
import { syncGoogleCalendarIntegration } from "@/services/google-calendar";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/signin",
    error: "/signin"
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Google verifies email ownership, so linking a Google sign-in to an
      // existing magic-link account with the same address is safe here.
      allowDangerousEmailAccountLinking: true
    }),
    Resend({
      from: process.env.EMAIL_FROM,
      maxAge: 60 * 60,
      async sendVerificationRequest({ identifier, url }) {
        const activeTokens = await prisma.verificationToken.count({
          where: {
            identifier,
            expires: { gt: new Date() }
          }
        });

        // the token for this request already exists, so >3 means a 4th link
        if (activeTokens > 3) {
          throw new Error("Too many sign-in links requested for this address");
        }

        await sendMagicLinkEmail({ to: identifier, url });
      }
    })
  ],
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      return session;
    }
  },
  events: {
    async signIn({ user, account }) {
      if (!user.id || !account) {
        return;
      }

      await syncGoogleCalendarIntegration({
        userId: user.id,
        account
      });
    },
    async createUser({ user }) {
      const userId = user.id;

      if (!userId) {
        return;
      }

      const existingVault = await prisma.vaultMember.findFirst({
        where: {
          userId
        }
      });

      if (existingVault) {
        return;
      }

      await prisma.$transaction(async (tx) => {
        const vault = await tx.vault.create({
          data: {
            name: user.name ? `${user.name.split(" ")[0]}'s Plants` : "My Plants"
          }
        });

        await tx.vaultMember.create({
          data: {
            vaultId: vault.id,
            userId,
            role: VaultRole.owner
          }
        });
      });
    }
  }
});
