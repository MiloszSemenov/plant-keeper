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

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    interval: "/ month",
    description: "A quiet start for your first shelf of plants.",
    cta: "Get started",
    features: ["Up to 10 plants", "1 space", "Basic care reminders", "Photo notes"]
  },
  {
    name: "Gardener",
    price: "$4.99",
    interval: "/ month",
    description: "Everything you need to keep a shared collection healthy.",
    cta: "Start free trial",
    featured: true,
    features: [
      "Unlimited plants",
      "Unlimited spaces",
      "Smart care reminders",
      "Plant history and stats",
      "Priority support"
    ]
  },
  {
    name: "Botanist",
    price: "$9.99",
    interval: "/ month",
    description: "For plant lovers who want deeper control and insight.",
    cta: "Start free trial",
    features: [
      "Everything in Gardener",
      "Advanced plant insights",
      "Custom care schedules",
      "Early feature access",
      "VIP support"
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
          <SignInButton
            className="landing-nav-signin"
            label="Sign in"
            showGoogleMark={false}
            size="text"
            variant="ghost"
          />
          <SignInButton
            className="landing-nav-cta"
            label="Get started"
            showGoogleMark={false}
            size="sm"
          />
        </div>
      </header>

      <main>
        <section className="landing-hero" id="product">
          <div className="landing-copy">
            <p className="eyebrow">The digital arboretum</p>
            <h1>
              Care for your plants.<br />
              Keep growing.
            </h1>
            <p className="landing-intro">
              PlantKeeper helps you organize your collection, remember
              watering schedules, and create the perfect environment
              for every plant in your home.
            </p>

            <div className="landing-actions">
              <SignInButton
                className="landing-primary-cta"
                label="Start your plant journey"
                showGoogleMark={false}
                size="lg"
                variant="primary"
              />
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

            <div className="landing-proof">
              <div className="avatar-cluster" aria-hidden="true">
                <span className="avatar-chip">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="avatar-chip__image" src="/plant-parents/woman1.jpg" />
                </span>
                <span className="avatar-chip">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="avatar-chip__image" src="/plant-parents/man.png" />
                </span>
                <span className="avatar-chip">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="avatar-chip__image" src="/plant-parents/woman2.png" />
                </span>
                <span className="avatar-chip">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="avatar-chip__image" src="/plant-parents/man2.jpg" />
                </span>
              </div>
              <div className="landing-proof-text">
                <span className="landing-stars" aria-hidden="true">★★★★★</span>
                <p>Join 10,000+ plant parents</p>
              </div>
            </div>
          </div>

          <div className="landing-preview-wrap" aria-label="PlantKeeper product preview">
            <div className="landing-dashboard panel">
              <div className="landing-dashboard-header">
                <div>
                  <p>Upcoming care</p>
                  <span>12 scheduled</span>
                </div>
                <button className="landing-water-pill" type="button">
                  <Icon name="water" />
                  Water all (12)
                </button>
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
            <Link className="landing-text-link" href="#product">
              Explore collections
              <span aria-hidden="true">-&gt;</span>
            </Link>
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
            <h2>Choose the plan that grows with you.</h2>
            <p>Simple, transparent pricing for every plant parent.</p>
          </div>

          <div className="landing-pricing-grid">
            {pricingPlans.map((plan) => (
              <article
                className={`landing-price-card${plan.featured ? " landing-price-card--featured" : ""}`}
                key={plan.name}
              >
                {plan.featured ? <p className="landing-price-ribbon">Most popular</p> : null}
                <div className="landing-price-copy">
                  <h3>{plan.name}</h3>
                  <p className="landing-price">
                    <strong>{plan.price}</strong>
                    <span>{plan.interval}</span>
                  </p>
                  <p>{plan.description}</p>
                </div>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Icon name="save" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  className={buttonClassName({
                    className: "landing-price-button",
                    size: "lg",
                    variant: plan.featured ? "primary" : "subtle"
                  })}
                  href="#"
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>

          <p className="landing-pricing-note">
            <Icon name="save" />
            14-day free trial. Cancel anytime.
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
        <p>© 2026 PlantKeeper Inc. Cultivating digital serenity.</p>
        <div>
          <Link href="#">Privacy</Link>
          <Link href="#">Terms</Link>
          <Link href="#">Github</Link>
        </div>
      </footer>
    </div>
  );
}
