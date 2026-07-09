// Dev-only helper: mints a local session cookie (Playwright storageState JSON)
// so authed pages can be driven/screenshotted headlessly.
// Usage: npx tsx scripts/dev-mint-session.ts [email] [out.json]
import fs from "node:fs";
import path from "node:path";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { encode } = await import("next-auth/jwt");

  const prisma = new PrismaClient();
  const email = process.argv[2] || "milosz.semenov@gmail.com";
  const user =
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.findFirst());

  if (!user) {
    console.error("no user found");
    process.exit(1);
  }

  const token = await encode({
    token: { sub: user.id, name: user.name, email: user.email, picture: user.image },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: "authjs.session-token",
  });

  const state = {
    cookies: [
      {
        name: "authjs.session-token",
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
        expires: Math.floor(Date.now() / 1000) + 86400,
      },
    ],
    origins: [],
  };

  fs.writeFileSync(process.argv[3] || "auth-state.json", JSON.stringify(state));
  console.log("session minted for:", user.email);
  await prisma.$disconnect();
}

main();
