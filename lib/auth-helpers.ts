import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiError } from "@/lib/http";
import { listUserVaults } from "@/services/vaults";

export async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  return session.user;
}

export async function requireApiUser() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ApiError(401, "You must be signed in");
  }

  return session.user;
}

export async function requireUserVault(vaultId?: string) {
  const user = await requireUser();
  const memberships = await listUserVaults(user.id);

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const selectedMembership =
    memberships.find((membership) => membership.vault.id === vaultId) ?? memberships[0];

  return {
    user,
    memberships,
    selectedMembership
  };
}
