import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "@/components/sign-in-button";
import { buttonClassName } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PlantCardBase } from "@/components/plant-card-base";

type PlantPreviewItem = {
  name: string;
  imagePath: string | null;
  scheduleLabel: string;
  lastWateredText: string;
  status: "overdue" | "today" | "upcoming";
};

const PLANT_POOL: PlantPreviewItem[] = [
  {
    name: "Monstera deliciosa",
    imagePath: "/plant-images/monstera.jpg",
    scheduleLabel: "Water in 5 days",
    lastWateredText: "3 days ago",
    status: "upcoming",
  },
  {
    name: "Snake Plant",
    imagePath: "/plant-images/snake-plant.jpg",
    scheduleLabel: "Water in 10 days",
    lastWateredText: "4 days ago",
    status: "upcoming",
  },
  {
    name: "Peace Lily",
    imagePath: "/plant-images/Spathiphyllum-wallisii.jpg",
    scheduleLabel: "Water in 2 days",
    lastWateredText: "5 days ago",
    status: "upcoming",
  },
  {
    name: "ZZ Plant",
    imagePath: "/plant-images/Zamia-Calculus.jpg",
    scheduleLabel: "Water in 14 days",
    lastWateredText: "today",
    status: "upcoming",
  },
  {
    name: "Pilea peperomioides",
    imagePath: "/plant-images/pilea-peperomioides.png",
    scheduleLabel: "Water in 7 days",
    lastWateredText: "today",
    status: "upcoming",
  },
  {
    name: "Pilea involucrata",
    imagePath: "/plant-images/Pilea-involucrata.jpg",
    scheduleLabel: "Water in 6 days",
    lastWateredText: "2 days ago",
    status: "upcoming",
  },
  {
    name: "Ficus ginseng",
    imagePath: "/plant-images/ficus-microcarpa.jpg",
    scheduleLabel: "Water in 8 days",
    lastWateredText: "yesterday",
    status: "upcoming",
  },
  {
    name: "Ficus microcarpa",
    imagePath: "/plant-images/ficus-microcarpa-2.jpg",
    scheduleLabel: "Water in 9 days",
    lastWateredText: "3 days ago",
    status: "upcoming",
  },
  {
    name: "Haworthiopsis attenuata",
    imagePath: "/plant-images/Haworthiopsis-attenuata.png",
    scheduleLabel: "Water in 12 days",
    lastWateredText: "2 days ago",
    status: "upcoming",
  },
  {
    name: "Phalaenopsis amabilis",
    imagePath: "/plant-images/Phalaenopsis-amabilis.jpg",
    scheduleLabel: "Water today",
    lastWateredText: "7 days ago",
    status: "today",
  },
  {
    name: "Veronica × andersonii",
    imagePath: "/plant-images/Veronica-×-andersonii.png",
    scheduleLabel: "Water in 3 days",
    lastWateredText: "5 days ago",
    status: "upcoming",
  },
  {
    name: "Crassula ovata",
    imagePath: "/plant-images/Crassula-ovata.jpg",
    scheduleLabel: "Water in 15 days",
    lastWateredText: "today",
    status: "upcoming",
  },
];

function selectPreviewPlants(pool: PlantPreviewItem[], count: number): PlantPreviewItem[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

type PricingPlan = {
  name: string;
  price?: string;
  interval?: string;
  description: string;
  features: string[];
  cta?: string;
  ribbon?: string;
  featured?: boolean;
  comingSoon?: boolean;
};

const pricingPlans: PricingPlan[] = [
  {
    name: "Free",
    price: "$0",
    interval: "/ month",
    description: "Everything you need to keep your plants alive and thriving.",
    cta: "Get started",
    ribbon: "Start here",
    featured: true,
    features: [
      "Unlimited spaces, shared with anyone",
      "Up to 50 plants per space",
      "5 AI photo identifications a month",
      "Watering schedules & email reminders",
      "Google Calendar sync"
    ]
  },
  {
    name: "Pro",
    description: "More AI and more automation for serious plant parents.",
    ribbon: "Coming soon",
    comingSoon: true,
    features: [
      "Everything in Free",
      "More AI photo identifications",
      "Unlimited plants per space",
      "Fertilizer schedules & reminders",
      "Seasonal watering adjustments"
    ]
  }
];

export default async function HomePage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  const previewPlants = selectPreviewPlants(PLANT_POOL, 6);

  return (
    <div className="landing-shell">
      <header className="landing-topbar">
        <Link className="landing-brand" href="/" aria-label="PlantKeeper home">
          <span className="landing-brand-mark">
            <Icon name="leafFill" />
          </span>
          <span>PlantKeeper</span>
        </Link>

        <nav className="landing-nav-links" aria-label="Landing page">
          <a className="active" href="#product">
            Product
          </a>
          <a href="#collections">Collections</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div className="landing-nav-actions">
          <Link
            className={buttonClassName({
              className: "landing-nav-signin",
              size: "text",
              variant: "ghost"
            })}
            href="/signin"
          >
            Sign in
          </Link>
          <Link
            className={buttonClassName({ className: "landing-nav-cta", size: "sm" })}
            href="/signin"
          >
            Get started
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero" id="product">
          <div className="landing-copy">
            <p className="eyebrow">Plant care, made simple</p>
            <h1>
              Care for your plants.<br />
              Keep growing.
            </h1>
            <p className="landing-intro">
              Snap a photo to identify any plant, get a watering schedule
              tuned to the species, and share the care with everyone at
              home.
            </p>

            <div className="landing-actions">
              <Link
                className={buttonClassName({
                  className: "landing-primary-cta",
                  size: "lg",
                  variant: "primary"
                })}
                href="/signin"
              >
                Start your plant journey
              </Link>
              <div className="landing-or-divider" role="separator">
                <span />
                <span>or</span>
                <span />
              </div>
              <SignInButton
                className="landing-google-cta"
                label="Continue with Google"
                size="lg"
                variant="subtle"
              />
            </div>

            <ul className="landing-hero-points">
              <li>
                <Icon name="cameraFill" />
                AI photo identification
              </li>
              <li>
                <Icon name="water" />
                Smart watering schedules
              </li>
              <li>
                <Icon name="usersFill" />
                Shared plant spaces
              </li>
            </ul>
          </div>

          <div className="landing-preview-wrap" aria-label="PlantKeeper product preview">
            <div className="landing-dashboard panel">
              <div className="landing-dashboard-header">
                <div>
                  <p>Upcoming care</p>
                  <span>12 scheduled</span>
                </div>
                <span aria-hidden="true" className="landing-water-pill">
                  <Icon name="water" />
                  Water all (12)
                </span>
              </div>

              <div className="landing-plant-grid">
                {previewPlants.map((plant) => (
                  <PlantCardBase
                    key={plant.name}
                    imageUrl={plant.imagePath}
                    lastWateredText={plant.lastWateredText}
                    name={plant.name}
                    status={plant.status}
                    statusLabel={plant.scheduleLabel}
                  />
                ))}
              </div>
            </div>

            <div className="landing-floating-card landing-floating-card--collections">
              <p className="eyebrow">My collections</p>
              <div>
                <span>
                  <Icon name="leafFill" />
                  The office
                </span>
                <strong>12</strong>
              </div>
              <div>
                <span>
                  <Icon name="home" />
                  Home jungle
                </span>
                <strong>8</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-showcase" id="collections">
          <div className="landing-showcase-copy">
            <p className="eyebrow">Collections</p>
            <h2>All your plants, beautifully organized.</h2>
            <p>
              Group your plants into spaces that match your rooms and routines. Everyone sees
              the same calm view of what needs attention next.
            </p>
            <SignInButton
              className="landing-text-link"
              label="Start your collection →"
              showGoogleMark={false}
              size="text"
              variant="ghost"
            />
          </div>

          <div className="landing-showcase-art" aria-label="Collection preview">
            <div className="landing-collection-card">
              <Icon name="leafFill" />
              <div>
                <strong>Living Room</strong>
                <p>12 plants</p>
                <div className="avatar-cluster" aria-hidden="true">
                  <span className="avatar-chip">M</span>
                  <span className="avatar-chip avatar-chip--soft">A</span>
                  <span className="avatar-chip avatar-chip--soft">J</span>
                  <span className="avatar-chip avatar-chip--count">+2</span>
                </div>
              </div>
            </div>
            <div className="landing-leaf-shadow" aria-hidden="true" />
          </div>
        </section>

        <section className="landing-pricing" id="pricing">
          <div className="landing-section-heading">
            <p className="eyebrow">Pricing</p>
            <h2>Start free. Upgrade when your jungle grows.</h2>
            <p>One simple free plan today — Pro is on the way.</p>
          </div>

          <div className="landing-pricing-grid">
            {pricingPlans.map((plan) => (
              <article
                className={`landing-price-card${plan.featured ? " landing-price-card--featured" : ""}`}
                key={plan.name}
              >
                {plan.ribbon ? <p className="landing-price-ribbon">{plan.ribbon}</p> : null}
                <div className="landing-price-copy">
                  <h3>{plan.name}</h3>
                  {plan.price ? (
                    <p className="landing-price">
                      <strong>{plan.price}</strong>
                      <span>{plan.interval}</span>
                    </p>
                  ) : (
                    <p className="landing-price">
                      <strong>TBA</strong>
                    </p>
                  )}
                  <p>{plan.description}</p>
                </div>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Icon name="check" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.comingSoon ? (
                  <button
                    className={buttonClassName({
                      className: "landing-price-button",
                      size: "lg",
                      variant: "subtle"
                    })}
                    disabled
                    type="button"
                  >
                    Coming soon
                  </button>
                ) : (
                  <Link
                    className={buttonClassName({
                      className: "landing-price-button",
                      size: "lg",
                      variant: "primary"
                    })}
                    href="/signin"
                  >
                    {plan.cta}
                  </Link>
                )}
              </article>
            ))}
          </div>

          <p className="landing-pricing-note">
            <Icon name="check" />
            Free means free — no credit card, no trial clock.
          </p>
        </section>
      </main>

      <footer className="landing-footer">
        <Link className="landing-brand" href="/" aria-label="PlantKeeper home">
          <span className="landing-brand-mark">
            <Icon name="leafFill" />
          </span>
          <span>PlantKeeper</span>
        </Link>
        <p>© 2026 PlantKeeper. Grown with care.</p>
        <div>
          <a
            href="https://github.com/MiloszSemenov/plant-keeper"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
