import { randomBytes } from "node:crypto";
import { prisma } from "@/db/client";
import { getAppUrl } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { sendVaultInviteEmail } from "@/services/email";
import { ensureVaultMembership, ensureVaultOwner } from "@/services/vaults";

const INVITE_EXPIRY_DAYS = 7;
const INVITE_CODE_PREFIX = "PLANT";
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type VaultInviteStatus = "waiting" | "joined" | "declined" | "expired";

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

function deriveInviteStatus(invite: {
  acceptedAt: Date | null;
  declinedAt: Date | null;
  expiresAt: Date;
}) {
  if (invite.acceptedAt) {
    return "joined" satisfies VaultInviteStatus;
  }

  if (invite.declinedAt) {
    return "declined" satisfies VaultInviteStatus;
  }

  if (invite.expiresAt < new Date()) {
    return "expired" satisfies VaultInviteStatus;
  }

  return "waiting" satisfies VaultInviteStatus;
}

function withInviteStatus<
  T extends {
    acceptedAt: Date | null;
    declinedAt: Date | null;
    expiresAt: Date;
  }
>(invite: T): T & { status: VaultInviteStatus } {
  return {
    ...invite,
    status: deriveInviteStatus(invite)
  };
}

async function acceptInviteRecord(
  invite: {
    id: string;
    vaultId: string;
    email: string | null;
    expiresAt: Date;
    acceptedAt: Date | null;
    declinedAt: Date | null;
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

  const inviteStatus = deriveInviteStatus(invite);

  if (inviteStatus === "joined") {
    throw new ApiError(409, "This invite has already been accepted");
  }

  if (inviteStatus === "declined") {
    throw new ApiError(409, "This invite has already been declined");
  }

  if (inviteStatus === "expired") {
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
    const existingMembership = await tx.vaultMember.findUnique({
      where: {
        vaultId_userId: {
          vaultId: invite.vaultId,
          userId
        }
      }
    });

    if (!existingMembership) {
      await tx.vaultMember.create({
        data: {
          vaultId: invite.vaultId,
          userId,
          role: "member"
        }
      });
    }

    const acceptedAt = new Date();

    await tx.vaultInvite.update({
      where: {
        id: invite.id
      },
      data: {
        acceptedAt,
        acceptedById: userId,
        declinedAt: null
      }
    });

    await tx.activityLog.create({
      data: {
        vaultId: invite.vaultId,
        userId,
        actionType: "invite_accepted",
        entityType: "invite",
        entityId: invite.id
      }
    });

    if (!existingMembership) {
      await tx.activityLog.create({
        data: {
          vaultId: invite.vaultId,
          userId,
          actionType: "member_joined",
          entityType: "member",
          entityId: userId
        }
      });
    }
  });

  return invite.vault;
}

async function declineInviteRecord(
  invite: {
    id: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    declinedAt: Date | null;
    vault: {
      id: string;
      name: string;
    };
  } | null
) {
  if (!invite) {
    throw new ApiError(404, "Invite not found");
  }

  const inviteStatus = deriveInviteStatus(invite);

  if (inviteStatus === "joined") {
    throw new ApiError(409, "This invite has already been accepted");
  }

  if (inviteStatus === "expired") {
    throw new ApiError(410, "This invite has expired");
  }

  if (inviteStatus === "declined") {
    return invite.vault;
  }

  await prisma.vaultInvite.update({
    where: {
      id: invite.id
    },
    data: {
      declinedAt: new Date()
    }
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

  const invite = await prisma.$transaction(async (tx) => {
    const createdInvite = await tx.vaultInvite.create({
      data: {
        vaultId,
        token,
        code,
        email: email || null,
        createdById: userId,
        expiresAt
      }
    });

    await tx.activityLog.create({
      data: {
        vaultId,
        userId,
        actionType: "invite_created",
        entityType: "invite",
        entityId: createdInvite.id
      }
    });

    return createdInvite;
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
  const invite = await prisma.vaultInvite.findUnique({
    where: {
      token
    },
    include: {
      vault: true,
      createdBy: true,
      acceptedBy: true
    }
  });

  return invite ? withInviteStatus(invite) : null;
}

export async function getInviteByCode(code: string) {
  const invite = await prisma.vaultInvite.findUnique({
    where: {
      code: normalizeInviteCode(code)
    },
    include: {
      vault: true,
      createdBy: true,
      acceptedBy: true
    }
  });

  return invite ? withInviteStatus(invite) : null;
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

export async function declineVaultInvite({ token }: { token: string }) {
  const invite = await prisma.vaultInvite.findUnique({
    where: {
      token
    },
    include: {
      vault: true
    }
  });

  return declineInviteRecord(invite);
}

export async function declineVaultInviteByCode({ code }: { code: string }) {
  const invite = await prisma.vaultInvite.findUnique({
    where: {
      code: normalizeInviteCode(code)
    },
    include: {
      vault: true
    }
  });

  return declineInviteRecord(invite);
}

export async function listVaultInvitesForSettings({
  userId,
  vaultId
}: {
  userId: string;
  vaultId: string;
}) {
  await ensureVaultMembership(userId, vaultId);

  const invites = await prisma.vaultInvite.findMany({
    where: {
      vaultId
    },
    include: {
      createdBy: true,
      acceptedBy: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return invites.map((invite) => withInviteStatus(invite));
}

export async function removeOrInvalidateVaultInvite({
  actingUserId,
  vaultId,
  inviteId
}: {
  actingUserId: string;
  vaultId: string;
  inviteId: string;
}) {
  await ensureVaultOwner(actingUserId, vaultId);

  const invite = await prisma.vaultInvite.findUnique({
    where: {
      id: inviteId
    }
  });

  if (!invite || invite.vaultId !== vaultId) {
    throw new ApiError(404, "Invite not found");
  }

  const inviteStatus = deriveInviteStatus(invite);

  if (inviteStatus === "waiting") {
    await prisma.vaultInvite.update({
      where: {
        id: invite.id
      },
      data: {
        expiresAt: new Date()
      }
    });

    return {
      action: "invalidated" as const
    };
  }

  await prisma.vaultInvite.delete({
    where: {
      id: invite.id
    }
  });

  return {
    action: "removed" as const
  };
}
