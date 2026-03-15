import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiError } from "@/lib/http";

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
