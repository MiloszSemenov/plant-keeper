import { randomBytes } from "node:crypto";
import { prisma } from "@/db/client";
import { getAppUrl } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { sendVaultInviteEmail } from "@/services/email";
import { ensureVaultOwner } from "@/services/vaults";

const INVITE_EXPIRY_DAYS = 7;
const INVITE_CODE_PREFIX = "PLANT";
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createInviteCodeValue() {
  const bytes = randomBytes(5);
  let suffix = "";

  for (const byte of bytes) {
    suffix += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
  }

  return `${INVITE_CODE_PREFIX}-${suffix}`;
}

async function generateUniqueInviteCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = createInviteCodeValue();
    const existingInvite = await prisma.vaultInvite.findUnique({
      where: {
        code
      }
    });

    if (!existingInvite) {
      return code;
    }
  }

  throw new ApiError(500, "Unable to generate invite code");
}

function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase();
}

async function acceptInviteRecord(
  invite: {
    id: string;
    vaultId: string;
    email: string | null;
    expiresAt: Date;
    acceptedAt: Date | null;
    vault: {
      id: string;
      name: string;
    };
  } | null,
  userId: string
) {
  if (!invite) {
    throw new ApiError(404, "Invite not found");
  }

  if (invite.acceptedAt) {
    throw new ApiError(409, "This invite has already been accepted");
  }

  if (invite.expiresAt < new Date()) {
    throw new ApiError(410, "This invite has expired");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId
    }
  });

  if (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new ApiError(403, "This invite is reserved for a different email address");
  }

  await prisma.$transaction(async (tx) => {
    await tx.vaultMember.upsert({
      where: {
        vaultId_userId: {
          vaultId: invite.vaultId,
          userId
        }
      },
      update: {},
      create: {
        vaultId: invite.vaultId,
        userId,
        role: "member"
      }
    });

    await tx.vaultInvite.update({
      where: {
        id: invite.id
      },
      data: {
        acceptedAt: new Date(),
        acceptedById: userId
      }
    });
  });

  return invite.vault;
}

export async function createVaultInvite({
  vaultId,
  userId,
  email
}: {
  vaultId: string;
  userId: string;
  email?: string;
}) {
  const membership = await ensureVaultOwner(userId, vaultId);
  const token = randomBytes(24).toString("hex");
  const code = await generateUniqueInviteCode();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const invite = await prisma.vaultInvite.create({
    data: {
      vaultId,
      token,
      code,
      email: email || null,
      createdById: userId,
      expiresAt
    }
  });

  const inviteUrl = `${getAppUrl()}/invite/${invite.token}`;
  const joinUrl = `${getAppUrl()}/join?code=${invite.code}`;

  if (email) {
    await sendVaultInviteEmail({
      to: email,
      vaultName: membership.vault.name,
      inviteUrl,
      inviterName: membership.user.name
    });
  }

  return {
    invite,
    inviteUrl,
    joinUrl
  };
}

export async function getInviteByToken(token: string) {
  return prisma.vaultInvite.findUnique({
    where: {
      token
    },
    include: {
      vault: true,
      createdBy: true,
      acceptedBy: true
    }
  });
}

export async function getInviteByCode(code: string) {
  return prisma.vaultInvite.findUnique({
    where: {
      code: normalizeInviteCode(code)
    },
    include: {
      vault: true,
      createdBy: true,
      acceptedBy: true
    }
  });
}

export async function acceptVaultInvite({
  token,
  userId
}: {
  token: string;
  userId: string;
}) {
  const invite = await prisma.vaultInvite.findUnique({
    where: {
      token
    },
    include: {
      vault: true
    }
  });

  return acceptInviteRecord(invite, userId);
}

export async function acceptVaultInviteByCode({
  code,
  userId
}: {
  code: string;
  userId: string;
}) {
  const invite = await prisma.vaultInvite.findUnique({
    where: {
      code: normalizeInviteCode(code)
    },
    include: {
      vault: true
    }
  });

  return acceptInviteRecord(invite, userId);
}
