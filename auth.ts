import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { VaultRole } from "@prisma/client";
import { prisma } from "@/db/client";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
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
