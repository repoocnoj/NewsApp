import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Share2 } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ai } from "@/lib/ai";
import { formatRelative, formatDate, safeParseJson } from "@/lib/utils";
import { BookmarkButton } from "@/components/bookmark-button";
import { ChatPanel } from "@/components/chat-panel";
import { SuggestedQuestions } from "@/components/suggested-questions";
import {
  enrichArticleAnalysis,
  enrichArticleSummary,
  findRelatedArticles,
} from "@/lib/article-enrich";

export const dynamic = "force-dynamic";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;
  const articleRaw = await db.article.findUnique({
    where: { id },
    include: {
      source: true,
      topicCluster: {
        include: {
          timelineEvents: { orderBy: { eventDate: "asc" } },
        },
      },
    },
  });
  if (!articleRaw) return notFound();

  // Strip off the non-Article relations before passing to enrichment helpers.
  const { topicCluster, ...articleBase } = articleRaw;
  // Lazy AI summary: first view runs a real summarization call against the
  // configured provider and caches the result on the row.
  const article = await enrichArticleSummary(articleBase);

  // Record view signal
  await db.articleSignal.upsert({
    where: { userId_articleId_kind: { userId: user.id, articleId: article.id, kind: "view" } },
    create: { userId: user.id, articleId: article.id, kind: "view" },
    update: {},
  });

  const bookmark = await db.bookmark.findUnique({
    where: { userId_articleId: { userId: user.id, articleId: article.id } },
  });

  // Dynamically find related coverage across other sources by tokenizing
  // headlines/summaries. This works for any ingested article, not just
  // the seeded topic clusters.
  let related: Array<typeof article> = [];
  let contrarianArticles: Array<typeof article> = [];
  let comparative = {
    commonFacts: [] as string[],
    disagreements: [] as Array<{ claim: string; sides: string[] }>,
    framingDifferences: [] as string[],
    missingContext: [] as string[],
  };
  let contrarian = {
    summary: "",
    whyItDiffers: "",
    supportingUrls: [] as Array<{ url: string; label: string }>,
  };
  let suggestions: { questions: string[] } = { questions: [] };
  try {
    const relatedSet = await findRelatedArticles(article, { limit: 6 });
    related = relatedSet.related.map((r) => r.article);
    contrarianArticles = relatedSet.contrarian.map((r) => r.article);

    // AI synthesis over the dynamically-computed related set, cached on
    // the article row for 6 hours.
    const bundle = await enrichArticleAnalysis(article, relatedSet);
    comparative = bundle.synthesis;
    contrarian = bundle.contrarian;
    suggestions = bundle.suggestions;
  } catch (err) {
    console.warn("[article] related/synthesis failed:", (err as Error).message);
  }

  // Timeline: use seeded events if this article belongs to a seeded
  // cluster; otherwise ask the AI to synthesize one from the related set.
  // Every path is wrapped so a timeline failure never takes down the page.
  const topicLabel = topicCluster?.label ?? article.headline;
  let timeline: Array<{
    date: string;
    title: string;
    description: string;
    sources: Array<{ url: string; label: string }>;
  }> = [];
  try {
    if (topicCluster && topicCluster.timelineEvents.length > 0) {
      timeline = topicCluster.timelineEvents.map((e) => ({
        date: e.eventDate.toISOString(),
        title: e.title,
        description: e.description,
        sources: safeParseJson<Array<{ url: string; label: string }>>(
          e.sourceRefsJson,
          [],
        ),
      }));
    } else if (related.length > 0) {
      timeline = await ai.timeline({
        topic: topicLabel,
        articles: [article, ...related].map((a) => ({
          source: a.source.name,
          url: a.url,
          headline: a.headline,
          publishedAt: a.publishedAt.toISOString(),
          summary: a.summaryShort,
        })),
      });
    }
  } catch (err) {
    console.warn("[article] timeline failed:", (err as Error).message);
  }

  const keyPoints = safeParseJson<string[]>(article.keyPointsJson, []);
  const topicTags = safeParseJson<string[]>(article.topicTagsJson, []);

  const aiProvider = (process.env.AI_PROVIDER || "mock").toLowerCase();
  const hasRealAI =
    (aiProvider === "openai" && !!process.env.OPENAI_API_KEY) ||
    (aiProvider === "anthropic" && !!process.env.ANTHROPIC_API_KEY);

  return (
    <div className="container grid gap-6 py-6 sm:py-8 lg:grid-cols-[1fr_380px] lg:gap-8">
      <article className="min-w-0 space-y-6 sm:space-y-8">
        {/* Header */}
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            <Link href="/feed" className="text-ink-muted hover:text-ink">
              ← Feed
            </Link>
            <span>·</span>
            <span className="font-medium text-ink-muted">{article.source.name}</span>
            {article.source.trustTier === "state-affiliated" && (
              <span className="chip text-accent-warn">state-affiliated</span>
            )}
            <span>·</span>
            <span>{formatRelative(article.publishedAt)}</span>
            <span>·</span>
            <span>{formatDate(article.publishedAt)}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
            {article.headline}
          </h1>
          {topicCluster && (
            <Link
              href={`/feed`}
              className="inline-flex items-center gap-2 text-sm text-brand"
            >
              #{topicCluster.label}
            </Link>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <ExternalLink className="h-4 w-4" /> Read at {article.source.name}
            </a>
            <BookmarkButton articleId={article.id} initial={!!bookmark} size="md" />
            <ShareButton url={article.url} headline={article.headline} />
          </div>
        </header>

        {/* Hero image */}
        {article.imageUrl && (
          <div className="overflow-hidden rounded-2xl border border-line bg-bg-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.imageUrl}
              alt=""
              className="max-h-[420px] w-full object-cover"
              loading="eager"
            />
          </div>
        )}

        {/* AI provider disclosure */}
        {!hasRealAI && (
          <div className="rounded-xl border border-dashed border-line bg-bg-subtle p-3 text-xs text-ink-muted">
            <span className="font-medium text-ink">Mock AI mode.</span> Summaries and
            cross-source synthesis below are generated by a deterministic local
            fallback — not a real model. To enable live AI, set{" "}
            <code className="rounded bg-bg-elevated px-1">AI_PROVIDER=anthropic</code> and{" "}
            <code className="rounded bg-bg-elevated px-1">ANTHROPIC_API_KEY=…</code>{" "}
            (or the OpenAI equivalents) in Vercel env vars, then redeploy.
          </div>
        )}

        {/* AI Summary */}
        <Section title="AI summary" subtitle="Neutral, grounded, citations below.">
          <div className="card p-5">
            <p className="text-base">{article.summaryLong || article.summaryShort}</p>
            {keyPoints.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                {keyPoints.map((kp, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand" />
                    <span>{kp}</span>
                  </li>
                ))}
              </ul>
            )}
            {topicTags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {topicTags.map((t) => (
                  <span key={t} className="chip">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* Article preview */}
        <Section title="Article preview" subtitle="Excerpt from the reporting. Link above opens the full source.">
          <div className="card p-5 prose-news max-w-none">
            <p className="text-sm text-ink-faint">
              {article.author ? `By ${article.author} · ` : ""}
              {article.source.name}
            </p>
            <div className="mt-3 max-h-80 overflow-hidden">
              <p>{article.articleText || article.previewText || article.summaryLong}</p>
            </div>
            <div className="mt-3">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand hover:underline"
              >
                Continue reading at {article.source.name} →
              </a>
            </div>
          </div>
        </Section>

        {/* Related coverage */}
        {related.length > 0 && (
          <Section title="Related coverage" subtitle="How other trusted sources are reporting this.">
            <div className="grid gap-3">
              {related.map((r: any) => (
                <Link
                  key={r.id}
                  href={`/article/${r.id}`}
                  className="card card-hover block p-4"
                >
                  <div className="text-xs text-ink-faint">
                    {r.source.name} · {formatRelative(r.publishedAt)}
                  </div>
                  <div className="mt-1 font-medium">{r.headline}</div>
                  <div className="mt-1 text-sm text-ink-muted line-clamp-2">
                    {r.summaryShort}
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* Agreement vs disagreement */}
        {(comparative.commonFacts.length > 0 ||
          comparative.disagreements.length > 0 ||
          comparative.framingDifferences.length > 0) && (
          <Section
            title="Agreement vs. disagreement"
            subtitle="What the sources corroborate, where they diverge, and what might be missing."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card p-5">
                <div className="label text-accent-ok">Broadly corroborated</div>
                <ul className="mt-3 space-y-2 text-sm">
                  {comparative.commonFacts.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent-ok" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {comparative.commonFacts.length === 0 && (
                    <li className="text-ink-muted">No clearly corroborated points identified.</li>
                  )}
                </ul>
              </div>
              <div className="card p-5">
                <div className="label text-accent-warn">Disputed or framed differently</div>
                <ul className="mt-3 space-y-3 text-sm">
                  {comparative.disagreements.map((d, i) => (
                    <li key={i}>
                      <div className="font-medium">{d.claim}</div>
                      <ul className="ml-3 mt-1 space-y-1 text-ink-muted">
                        {d.sides.map((s, j) => (
                          <li key={j}>— {s}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                  {comparative.disagreements.length === 0 && (
                    <li className="text-ink-muted">No notable disagreements detected.</li>
                  )}
                </ul>
              </div>
              {comparative.framingDifferences.length > 0 && (
                <div className="card p-5 md:col-span-2">
                  <div className="label">Framing differences</div>
                  <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                    {comparative.framingDifferences.map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {comparative.missingContext.length > 0 && (
                <div className="card p-5 md:col-span-2">
                  <div className="label">Missing context to watch for</div>
                  <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                    {comparative.missingContext.map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Contrarian view */}
        {(contrarianArticles.length > 0 || contrarian.summary) && (
          <Section
            title="Contrarian view"
            subtitle="Alternative or opposing framing from different geographies or ideological vantage points."
          >
            <div className="card p-5">
              {contrarian.summary && <p className="text-sm">{contrarian.summary}</p>}
              {contrarian.whyItDiffers && (
                <p className="mt-3 text-sm text-ink-muted">
                  <span className="font-medium text-ink">Why it differs: </span>
                  {contrarian.whyItDiffers}
                </p>
              )}
              {contrarianArticles.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {contrarianArticles.map((a: any) => (
                    <Link
                      key={a.id}
                      href={`/article/${a.id}`}
                      className="block rounded-xl border border-line bg-bg p-3 text-sm hover:bg-bg-elevated"
                    >
                      <div className="flex items-center gap-2 text-xs text-ink-faint">
                        <span className="font-medium text-ink-muted">{a.source.name}</span>
                        {a.source.trustTier === "state-affiliated" && (
                          <span className="chip text-accent-warn">state-affiliated</span>
                        )}
                      </div>
                      <div className="mt-1 font-medium">{a.headline}</div>
                      <div className="mt-1 text-ink-muted line-clamp-2">{a.summaryShort}</div>
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-3 text-xs text-ink-faint">
                Note: presence here does not imply endorsement. State-affiliated and advocacy
                outlets are labeled so you can weigh them accordingly.
              </div>
            </div>
          </Section>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <Section title="Timeline" subtitle="How we got here, with sources when available.">
            <ol className="relative space-y-5 border-l border-line pl-6">
              {timeline.map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[29px] top-1.5 h-3 w-3 rounded-full border-2 border-bg bg-brand" />
                  <div className="text-xs text-ink-faint">{formatDate(e.date)}</div>
                  <div className="mt-0.5 font-medium">{e.title}</div>
                  <div className="text-sm text-ink-muted">{e.description}</div>
                  {e.sources && e.sources.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {e.sources.map((s, j) => (
                        <a
                          key={j}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="chip hover:text-ink"
                        >
                          {s.label}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Section>
        )}
      </article>

      <aside className="space-y-6 lg:sticky lg:top-16 lg:h-fit lg:self-start">
        <ChatPanel articleId={article.id} articleHeadline={article.headline} />
        <SuggestedQuestions
          articleId={article.id}
          questions={suggestions.questions || []}
        />
      </aside>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ShareButton({ url, headline }: { url: string; headline: string }) {
  return (
    <a
      href={`mailto:?subject=${encodeURIComponent(headline)}&body=${encodeURIComponent(url)}`}
      className="btn-ghost"
    >
      <Share2 className="h-4 w-4" /> Share
    </a>
  );
}
