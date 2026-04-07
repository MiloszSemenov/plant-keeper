import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "@/components/sign-in-button";
import { buttonClassName } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">Plant Keeper</p>
          <h1>Plant care that feels clear from day one.</h1>
          <p className="landing-intro">
            Log in with Google, create shared spaces, identify plants from photos, and keep
            watering on track without turning the app into a chore.
          </p>
          <div className="landing-actions">
            <SignInButton label="Get started with Google" size="lg" />
            <Link
              className={buttonClassName({
                size: "lg",
                variant: "ghost"
              })}
              href="#how-it-works"
            >
              How it works
            </Link>
          </div>
          <div className="landing-meta">
            <span>Shared spaces</span>
            <span>Photo identify</span>
            <span>Daily reminders</span>
          </div>
        </div>

        <div className="preview-window panel">
          <div className="preview-header">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-body">
            <div className="preview-sidebar">
              <strong>Spaces</strong>
              <small>Home Jungle</small>
              <small>Studio Plants</small>
              <small>Office Shelf</small>
            </div>
            <div className="preview-content">
              <div className="preview-summary">
                <div>
                  <span>Today</span>
                  <strong>3</strong>
                </div>
                <div>
                  <span>Upcoming</span>
                  <strong>5</strong>
                </div>
              </div>

              <article className="preview-plant-card">
                <div className="preview-plant-media">M</div>
                <div className="stack-xs">
                  <strong>Living room Monstera</strong>
                  <p>Monstera deliciosa</p>
                  <span className="status-pill status-warning">Water today</span>
                </div>
              </article>

              <article className="preview-upload-card">
                <strong>Photo upload</strong>
                <p>Drop a leaf photo and get species suggestions instantly.</p>
              </article>

              <article className="preview-reminder-card">
                <strong>Reminder email</strong>
                <p>One daily digest with every plant that needs water.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="how-grid" id="how-it-works">
        <article className="panel how-card">
          <p className="eyebrow">Step 1</p>
          <h2>Sign in and create your first space.</h2>
          <p>Home, studio, office shelf. Each space can be private or shared with other people.</p>
        </article>
        <article className="panel how-card">
          <p className="eyebrow">Step 2</p>
          <h2>Add plants by photo or by name.</h2>
          <p>Upload a photo for matches, or type a species name and pick it from suggestions.</p>
        </article>
        <article className="panel how-card">
          <p className="eyebrow">Step 3</p>
          <h2>Water on time and keep everyone synced.</h2>
          <p>Mark plants as watered, track what is due next, and send one reminder digest per day.</p>
        </article>
      </section>

      <section className="feature-grid">
        <article className="panel feature-card">
          <p className="eyebrow">Dashboard</p>
          <h2>See overdue, today, and upcoming at a glance.</h2>
          <p>No clutter, just the next actions that matter.</p>
        </article>
        <article className="panel feature-card">
          <p className="eyebrow">Plant cards</p>
          <h2>Keep a photo, name, schedule, and history together.</h2>
          <p>Each plant keeps a simple record that is easy to share with others.</p>
        </article>
        <article className="panel feature-card">
          <p className="eyebrow">Reminders</p>
          <h2>Get one daily nudge instead of a flood of notifications.</h2>
          <p>Useful enough to trust, quiet enough to keep.</p>
        </article>
      </section>
    </main>
  );
}
