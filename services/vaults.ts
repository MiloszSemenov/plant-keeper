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

function getActivityActorName(user: { name: string | null; email: string }) {
  return user.name ?? user.email;
}

function getActivityDescription(
  activity: {
    actionType: string;
    user: {
      name: string | null;
      email: string;
    };
    entityId: string;
  },
  plantNameById: Map<string, string>
) {
  const actorName = getActivityActorName(activity.user);

  if (activity.actionType === "plant_created") {
    return `${actorName} added ${plantNameById.get(activity.entityId) ?? "a plant"}`;
  }

  if (activity.actionType === "plant_watered") {
    return `${actorName} watered ${plantNameById.get(activity.entityId) ?? "a plant"}`;
  }

  if (activity.actionType === "invite_created") {
    return `${actorName} created an invite link`;
  }

  if (activity.actionType === "invite_accepted") {
    return `${actorName} accepted an invite`;
  }

  if (activity.actionType === "member_joined") {
    return `${actorName} joined the space`;
  }

  if (activity.actionType === "member_left") {
    return `${actorName} left the space`;
  }

  return `${actorName} updated the space`;
}

export async function getVaultActivity(
  userId: string,
  vaultId: string,
  options?: {
    take?: number;
  }
) {
  await ensureVaultMembership(userId, vaultId);

  const activities = await prisma.activityLog.findMany({
    where: {
      vaultId
    },
    include: {
      user: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: options?.take ?? 10
  });

  const plantIds = Array.from(
    new Set(
      activities
        .filter((activity) => activity.entityType === "plant")
        .map((activity) => activity.entityId)
    )
  );
  const plants =
    plantIds.length === 0
      ? []
      : await prisma.plant.findMany({
          where: {
            id: {
              in: plantIds
            }
          },
          select: {
            id: true,
            nickname: true
          }
        });
  const plantNameById = new Map(plants.map((plant) => [plant.id, plant.nickname]));

  return activities.map((activity) => ({
    id: activity.id,
    createdAt: activity.createdAt,
    description: getActivityDescription(activity, plantNameById)
  }));
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

export async function deleteOrLeaveVault(userId: string, vaultId: string) {
  const membership = await ensureVaultMembership(userId, vaultId);

  if (membership.role === VaultRole.owner) {
    await prisma.vault.delete({
      where: {
        id: vaultId
      }
    });

    return {
      action: "deleted" as const
    };
  }

  await prisma.$transaction(async (tx) => {
    const plantIds = await tx.plant.findMany({
      where: {
        vaultId
      },
      select: {
        id: true
      }
    });

    await tx.activityLog.create({
      data: {
        vaultId,
        userId,
        actionType: "member_left",
        entityType: "member",
        entityId: userId
      }
    });

    await tx.notificationSetting.deleteMany({
      where: {
        userId,
        OR: [
          {
            vaultId
          },
          {
            plantId: {
              in: plantIds.map((plant) => plant.id)
            }
          }
        ]
      }
    });

    await tx.vaultMember.delete({
      where: {
        vaultId_userId: {
          vaultId,
          userId
        }
      }
    });
  });

  return {
    action: "left" as const
  };
}
