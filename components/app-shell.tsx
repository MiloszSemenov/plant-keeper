import Link from "next/link";
import { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";

type VaultOption = {
  id: string;
  name: string;
  role: string;
  plantCount: number;
  memberCount: number;
};

export function AppShell({
  title,
  description,
  userName,
  currentVaultId,
  currentPath,
  canManagePlants = true,
  vaults,
  actions,
  children
}: {
  title: string;
  description: string;
  userName?: string | null;
  currentVaultId?: string;
  currentPath: "/dashboard" | "/plants" | "/add-plant" | "/spaces/settings";
  canManagePlants?: boolean;
  vaults: VaultOption[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const hrefForVault = (vaultId: string) => `${currentPath}?vaultId=${vaultId}`;
  const myCollections = vaults.filter((vault) => vault.role === "owner");
  const sharedCollections = vaults.filter((vault) => vault.role !== "owner");

  function renderVaultGroup(label: string, items: VaultOption[]) {
    if (items.length === 0) {
      return null;
    }

    return (
      <div className="vault-group">
        <p className="eyebrow">{label}</p>
        <div className="vault-list">
          {items.map((vault) => (
            <Link
              className={vault.id === currentVaultId ? "vault-chip active" : "vault-chip"}
              href={hrefForVault(vault.id)}
              key={vault.id}
            >
              <strong>{vault.name}</strong>
              <span>
                {vault.plantCount} plants | {vault.memberCount} members
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">PK</span>
          <span>
            Plant Keeper
            <small>Shared care for houseplants</small>
          </span>
        </Link>
        <div className="topbar-actions">
          {actions}
          <Link className="button button-ghost" href="/join">
            Join space
          </Link>
          <SignOutButton />
        </div>
      </header>

      <div className="shell-grid">
        <aside className="sidebar panel">
          <div className="stack-sm">
            <div>
              <p className="eyebrow">Caretaker</p>
              <h2>{userName ?? "Plant lover"}</h2>
            </div>
            <nav className="nav-links">
              <Link
                className={currentPath === "/dashboard" ? "nav-link active" : "nav-link"}
                href={currentVaultId ? `/dashboard?vaultId=${currentVaultId}` : "/dashboard"}
              >
                Dashboard
              </Link>
              {canManagePlants ? (
                <Link
                  className={currentPath === "/add-plant" ? "nav-link active" : "nav-link"}
                  href={currentVaultId ? `/add-plant?vaultId=${currentVaultId}` : "/add-plant"}
                >
                  Add plant
                </Link>
              ) : null}
              <Link
                className={currentPath === "/plants" ? "nav-link active" : "nav-link"}
                href={currentVaultId ? `/plants?vaultId=${currentVaultId}` : "/plants"}
              >
                All plants
              </Link>
              <Link
                className={currentPath === "/spaces/settings" ? "nav-link active" : "nav-link"}
                href={currentVaultId ? `/spaces/settings?vaultId=${currentVaultId}` : "/spaces/settings"}
              >
                Space settings
              </Link>
            </nav>
          </div>

          <div className="stack-sm">
            <div>
              <p className="eyebrow">Spaces</p>
              <h3>Collections</h3>
            </div>
            {renderVaultGroup("My Collections", myCollections)}
            {renderVaultGroup("Shared Collections", sharedCollections)}
          </div>
        </aside>

        <main className="main-area">
          <section className="hero-card panel">
            <div className="hero-copy">
              <p className="eyebrow">Plant Ops</p>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
