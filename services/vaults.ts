import { VaultRole } from "@prisma/client";
import { prisma } from "@/db/client";
import { ApiError } from "@/lib/http";

export function canManagePlants(role: VaultRole) {
  return role === VaultRole.owner || role === VaultRole.editor;
}

export async function ensureVaultMembership(userId: string, vaultId: string) {
  const membership = await prisma.vaultMember.findUnique({
    where: {
      vaultId_userId: {
        vaultId,
        userId
      }
    },
    include: {
      vault: true,
      user: true
    }
  });

  if (!membership) {
    throw new ApiError(403, "You do not have access to this vault");
  }

  return membership;
}

export async function ensureVaultEditor(userId: string, vaultId: string) {
  const membership = await ensureVaultMembership(userId, vaultId);

  if (!canManagePlants(membership.role)) {
    throw new ApiError(403, "Only owners and editors can perform this action");
  }

  return membership;
}

export async function ensureVaultOwner(userId: string, vaultId: string) {
  const membership = await ensureVaultMembership(userId, vaultId);

  if (membership.role !== VaultRole.owner) {
    throw new ApiError(403, "Only vault owners can perform this action");
  }

  return membership;
}

export async function listUserVaults(userId: string) {
  const memberships = await prisma.vaultMember.findMany({
    where: {
      userId
    },
    include: {
      vault: {
        include: {
          _count: {
            select: {
              plants: true,
              memberships: true
            }
          }
        }
      }
    }
  });

  return memberships.sort(
    (left, right) => left.vault.createdAt.getTime() - right.vault.createdAt.getTime()
  );
}

export async function createVault(userId: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const vault = await tx.vault.create({
      data: {
        name: name.trim()
      }
    });

    await tx.vaultMember.create({
      data: {
        vaultId: vault.id,
        userId,
        role: VaultRole.owner
      }
    });

    return vault;
  });
}

export async function getVaultSettings(userId: string, vaultId: string) {
  await ensureVaultMembership(userId, vaultId);

  return prisma.vault.findUniqueOrThrow({
    where: {
      id: vaultId
    },
    include: {
      memberships: {
        include: {
          user: true
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      invites: {
        where: {
          acceptedAt: null
        },
        include: {
          createdBy: true
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      notificationSettings: {
        where: {
          userId
        },
        take: 1
      },
      _count: {
        select: {
          plants: true
        }
      }
    }
  });
}

export async function updateVaultMemberRole({
  actingUserId,
  vaultId,
  memberId,
  role
}: {
  actingUserId: string;
  vaultId: string;
  memberId: string;
  role: "editor" | "member";
}) {
  await ensureVaultOwner(actingUserId, vaultId);

  if (memberId === actingUserId) {
    throw new ApiError(400, "Owners cannot change their own role");
  }

  return prisma.vaultMember.update({
    where: {
      vaultId_userId: {
        vaultId,
        userId: memberId
      }
    },
    data: {
      role
    }
  });
}

export async function removeVaultMember({
  actingUserId,
  vaultId,
  memberId
}: {
  actingUserId: string;
  vaultId: string;
  memberId: string;
}) {
  await ensureVaultOwner(actingUserId, vaultId);

  if (memberId === actingUserId) {
    throw new ApiError(400, "Owners cannot remove themselves");
  }

  await prisma.vaultMember.delete({
    where: {
      vaultId_userId: {
        vaultId,
        userId: memberId
      }
    }
  });

  return {
    removed: true
  };
}
