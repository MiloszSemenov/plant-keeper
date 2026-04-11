import Link from "next/link";
import { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonClassName } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type VaultOption = {
  id: string;
  name: string;
  role: string;
  plantCount: number;
  memberCount: number;
};

function getInitials(value?: string | null) {
  if (!value) {
    return "PK";
  }

  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell({
  title,
  description,
  userName,
  userImageUrl,
  currentVaultId,
  currentPath,
  canManagePlants = true,
  vaults,
  actions,
  sidebarContent,
  children
}: {
  title: string;
  description: string;
  userName?: string | null;
  userImageUrl?: string | null;
  currentVaultId?: string;
  currentPath: "/dashboard" | "/plants" | "/add-plant" | "/spaces/settings";
  canManagePlants?: boolean;
  vaults: VaultOption[];
  actions?: ReactNode;
  sidebarContent?: ReactNode;
  children: ReactNode;
}) {
  const hrefForVault = (vaultId: string) => `${currentPath}?vaultId=${vaultId}`;
  const currentVault = vaults.find((vault) => vault.id === currentVaultId) ?? vaults[0];
  const myCollections = vaults.filter((vault) => vault.role === "owner");
  const sharedCollections = vaults.filter((vault) => vault.role !== "owner");
  const remainingGardeners = Math.max((currentVault?.memberCount ?? 1) - 2, 0);
  const navigationItems: Array<{
    href: string;
    icon: IconName;
    label: string;
    active: boolean;
  }> = [
    {
      active: currentPath === "/dashboard",
      href: currentVaultId ? `/dashboard?vaultId=${currentVaultId}` : "/dashboard",
      icon: "dashboard",
      label: "Dashboard"
    },
    {
      active: currentPath === "/plants",
      href: currentVaultId ? `/plants?vaultId=${currentVaultId}` : "/plants",
      icon: "plant",
      label: "Plants"
    },
    ...(canManagePlants
      ? [
          {
            active: currentPath === "/add-plant",
            href: currentVaultId ? `/add-plant?vaultId=${currentVaultId}` : "/add-plant",
            icon: "add" as const,
            label: "Add Plant"
          }
        ]
      : []),
    {
      active: currentPath === "/spaces/settings",
      href: currentVaultId ? `/spaces/settings?vaultId=${currentVaultId}` : "/spaces/settings",
      icon: "settings",
      label: "Settings"
    }
  ];

  function renderVaultGroup(label: string, items: VaultOption[]) {
    if (items.length === 0) {
      return null;
    }

    return (
      <div className="vault-group sidebar-section">
        <p className="sidebar-label">{label}</p>
        <div className="vault-list">
          {items.map((vault) => (
            <Link
              className={cn("vault-chip", vault.id === currentVaultId && "active")}
              href={hrefForVault(vault.id)}
              key={vault.id}
            >
              <div className="vault-chip__meta">
                <span className="vault-chip__icon">
                  <Icon
                    className="vault-chip__icon-mark"
                    name={vault.role === "owner" ? "home" : "spaces"}
                  />
                </span>
                <div>
                  <strong>{vault.name}</strong>
                  <span>
                    {vault.plantCount} plants | {vault.memberCount} members
                  </span>
                </div>
              </div>
              {/* {vault.id === currentVaultId ? <span className="vault-chip__active">Live</span> : null} */}
              {vault.id === currentVaultId ? (<img src="/icons/save.svg" alt="active" className="vault-chip__icon save-icon" />) : null}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="shell-grid">
        <aside className="sidebar panel">
          <div className="sidebar-header">
            <Link className="brand brand--sidebar" href="/dashboard">
              <span>
                <strong>Plant Keeper</strong>
                <small>The Digital Arboretum</small>
              </span>
            </Link>
          </div>

          <nav className="nav-links" aria-label="Primary">
            {navigationItems.map((item) => (
              <Link
                className={cn("nav-link", item.active && "active")}
                href={item.href}
                key={item.href}
              >
                <Icon className="nav-link__icon" name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="sidebar-stack">
            {renderVaultGroup("My collections", myCollections)}
            {renderVaultGroup("Shared collections", sharedCollections)}

            {sidebarContent ? <div className="sidebar-section">{sidebarContent}</div> : null}

            {currentVault ? (
              <section className="sidebar-section sidebar-gardeners">
                <p className="sidebar-label">Gardeners</p>
                <div className="gardeners-row">
                  <div className="avatar-cluster" aria-hidden="true">
                    <span className="avatar-chip">
                      {userImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={userName ?? "Profile"} className="avatar-chip__image" src={userImageUrl} />
                      ) : (
                        getInitials(userName)
                      )}
                    </span>
                    <span className="avatar-chip avatar-chip--soft">{getInitials(currentVault.name)}</span>
                    {remainingGardeners > 0 ? (
                      <span className="avatar-chip avatar-chip--count">+{remainingGardeners}</span>
                    ) : null}
                  </div>
                  <Link
                      className={buttonClassName({
                        size: "sm",
                        variant: "ghost"
                      })}
                      href={
                        currentVaultId
                          ? `/spaces/settings?vaultId=${currentVaultId}`
                          : "/spaces/settings"
                      }
                    >
                      <Icon className="ui-button__icon" name="invite" />
                      Invite collaborator
                  </Link>
                </div>
                <p className="gardeners-copy">
                  {currentVault.memberCount} people care for this space together.
                </p>
              </section>
            ) : null}
          </div>
        </aside>

        <div className="main-area">
          <header className="topbar">
            <div className="topbar-copy">
              <div>
                <h1 className="topbar-title">{title}</h1>
                <p>{description}</p>
              </div>
              <Input
                aria-label="Search collection"
                className="topbar-search__field"
                containerClassName="topbar-search"
                placeholder="Search collection..."
                type="search"
                icon="search"
              />
            </div>

            <div className="topbar-actions">
              {actions}
              <Link
                className={buttonClassName({
                  size: "sm",
                  variant: "subtle"
                })}
                href="/join"
              >
                Join space
              </Link>
              <SignOutButton />
              {/* <span className="topbar-divider" />
              <button
                aria-label="Notifications"
                className={buttonClassName({
                  size: "icon",
                  variant: "ghost"
                })}
                type="button"
              >
                <Icon className="ui-button__icon" name="notifications" />
              </button>
              <span className="topbar-avatar">
                {userImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={userName ?? "Profile"} className="topbar-avatar__image" src={userImageUrl} />
                ) : (
                  getInitials(userName)
                )}
              </span> */}
            </div>
          </header>

          <main className="dashboard-shell">{children}</main>
        </div>
      </div>
    </div>
  );
}
