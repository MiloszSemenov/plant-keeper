import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/db/client";
import { requireUser } from "@/lib/auth-helpers";
import { isAdminEmail } from "@/lib/admin";
import {
  FREE_MONTHLY_PHOTO_IDENTIFICATIONS,
  getGlobalDailyPhotoIdentificationLimit
} from "@/lib/plan-limits";
import { formatDate } from "@/lib/time";
import { Icon } from "@/components/ui/icon";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireUser();

  if (!isAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [
    userCount,
    newUserCount,
    plantCount,
    vaultCount,
    monthlyIdentifications,
    dailyUsage,
    cacheCount,
    recentUsers
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.plant.count(),
    prisma.vault.count(),
    prisma.userUsage.aggregate({
      _sum: { photoIdentificationsUsed: true },
      where: { periodStart }
    }),
    prisma.dailyUsage.findUnique({ where: { date: today } }),
    prisma.plantIdentificationCache.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, email: true, name: true, createdAt: true }
    })
  ]);

  const identificationsThisMonth = monthlyIdentifications._sum.photoIdentificationsUsed ?? 0;
  const identificationsToday = dailyUsage?.photoIdentificationsUsed ?? 0;
  const dailyLimit = getGlobalDailyPhotoIdentificationLimit();

  const stats = [
    { label: "Users", value: userCount },
    { label: "New users (7 days)", value: newUserCount },
    { label: "Plants", value: plantCount },
    { label: "Spaces", value: vaultCount },
    {
      label: "AI identifications (this month)",
      value: identificationsThisMonth,
      hint: `${FREE_MONTHLY_PHOTO_IDENTIFICATIONS}/user limit`
    },
    {
      label: "AI identifications (today)",
      value: `${identificationsToday} / ${dailyLimit}`,
      hint: "global daily cap"
    },
    { label: "Cached identifications", value: cacheCount }
  ];

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>Admin</h1>
          <p className="muted">Plant Keeper internals — visible only to admins.</p>
        </div>
        <Link className="back-link" href="/dashboard">
          <Icon name="back" />
          Back to dashboard
        </Link>
      </header>

      <section aria-label="Statistics" className="admin-stats">
        {stats.map((stat) => (
          <article className="panel admin-stat" key={stat.label}>
            <p className="admin-stat__label">{stat.label}</p>
            <p className="admin-stat__value">{stat.value}</p>
            {stat.hint ? <p className="admin-stat__hint">{stat.hint}</p> : null}
          </article>
        ))}
      </section>

      <section aria-label="Recent signups" className="panel admin-recent">
        <h2>Recent signups</h2>
        {recentUsers.length === 0 ? (
          <p className="muted">No users yet.</p>
        ) : (
          <ul className="admin-user-list">
            {recentUsers.map((recentUser) => (
              <li className="admin-user-row" key={recentUser.id}>
                <div>
                  <p className="admin-user-row__name">{recentUser.name ?? "—"}</p>
                  <p className="admin-user-row__email">{recentUser.email}</p>
                </div>
                <time dateTime={recentUser.createdAt.toISOString()}>
                  {formatDate(recentUser.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
