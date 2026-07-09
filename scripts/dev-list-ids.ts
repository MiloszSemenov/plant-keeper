import fs from "node:fs";

const envFile = fs.readFileSync(".env", "utf8");
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { email: "milosz.semenov@gmail.com" } });
  if (!user) throw new Error("no user");
  const memberships = await prisma.vaultMember.findMany({
    where: { userId: user.id },
    include: { vault: { include: { plants: { take: 1 } } } },
  });
  for (const m of memberships) {
    console.log("vault", m.vault.id, "|", m.vault.name, "| plant", m.vault.plants[0]?.id ?? "none");
  }
  const invite = await prisma.vaultInvite.findFirst({ where: { email: { not: null } } });
  console.log("invite-token", invite?.token ?? "none");
  await prisma.$disconnect();
}

main();
