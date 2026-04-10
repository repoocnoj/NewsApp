import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, setSessionUserId } from "@/lib/session";

async function signInAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const name = String(formData.get("name") || "").trim() || null;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return;
  }
  const user = await db.user.upsert({
    where: { email },
    create: { email, name },
    update: name ? { name } : {},
  });
  await setSessionUserId(user.id);

  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  if (!pref || !pref.onboardingCompleted) {
    redirect("/onboarding");
  }
  redirect("/feed");
}

export default async function SignInPage() {
  const current = await getCurrentUser();
  if (current) redirect("/feed");
  return (
    <div className="container py-20">
      <div className="mx-auto max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-semibold">Sign in to NewsApp</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Dev-friendly email sign-in. Use any email to create a local account — no
            password required while in development.
          </p>
          <form action={signInAction} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="input mt-1"
              />
            </div>
            <div>
              <label className="label">Name (optional)</label>
              <input name="name" type="text" placeholder="Your name" className="input mt-1" />
            </div>
            <button className="btn-primary w-full" type="submit">
              Continue
            </button>
          </form>
          <div className="mt-6 text-xs text-ink-faint">
            A seeded demo account exists at <code>demo@newsapp.local</code>. Sign in with it to
            skip onboarding.
          </div>
          <div className="mt-4 text-center text-xs">
            <Link href="/" className="text-ink-muted hover:text-ink">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
