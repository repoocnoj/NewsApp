import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/feed");

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Truth-seeking news, personalized
        </div>
        <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
          Reach ground truth on the stories you care about.
        </h1>
        <p className="mt-5 text-lg text-ink-muted md:text-xl">
          NewsApp combines trusted sources, multiple viewpoints, and AI synthesis — so
          you can see what&rsquo;s corroborated, what&rsquo;s disputed, and what&rsquo;s missing.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signin" className="btn-primary">
            Get started
          </Link>
          <Link href="/signin" className="btn-ghost">
            I already have an account
          </Link>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          <Feature
            title="Side-by-side coverage"
            body="See how Reuters, BBC, Al Jazeera, Tehran Times, and more cover the same story — with clearly surfaced agreement and disagreement."
          />
          <Feature
            title="Timelines with citations"
            body="Understand the long arc of an issue through dated events, each linked back to source material."
          />
          <Feature
            title="Ask and dig deeper"
            body="Chat with an AI grounded in the article and related reporting. It will say when something is contested or unclear."
          />
        </div>
      </div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5">
      <div className="mb-2 h-8 w-8 rounded-lg bg-gradient-to-br from-brand/30 to-accent/20" />
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sm text-ink-muted">{body}</div>
    </div>
  );
}
