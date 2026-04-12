import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink, Share2, Loader2 } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ai } from "@/lib/ai";
import { formatRelative, formatDate, safeParseJson } from "@/lib/utils";
import { BookmarkButton } from "@/components/bookmark-button";
import { ChatPanel } from "@/components/chat-panel";
import { SuggestedQuestions } from "@/components/suggested-questions";
import { ArticleReader } from "@/components/article-reader";
import {
  enrichArticleAnalysis,
  enrichArticleSummary,
  findRelatedArticles,
} from "@/lib/article-enrich";
import { AIAnalysisSkeleton } from "./loading";

export const dynamic = "force-dynamic";

/**
 * PROGRESSIVE RENDERING — the article page now has two phases:
 *
 * Phase 1 (instant, ~200ms): header, hero image, article preview,
 *   chat panel shell. These come from a single fast DB query.
 *
 * Phase 2 (streamed, 2–15s): AI summary, related coverage,
 *   agreement/disagreement synthesis, contrarian view, timeline,
 *   suggested questions. These are wrapped in <Suspense> so the
 *   user sees a skeleton while the AI calls complete. Sections
 *   stream into the page as they finish.
 */
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;

  // FAST: single DB query — no AI, no network calls.
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

  // FAST: record view + check bookmark (parallel DB queries).
  const [, bookmark] = await Promise.all([
    db.articleSignal.upsert({
      where: { userId_articleId_kind: { userId: user.id, articleId: articleRaw.id, kind: "view" } },
      create: { userId: user.id, articleId: articleRaw.id, kind: "view" },
      update: {},
    }),
    db.bookmark.findUnique({
      where: { userId_articleId: { userId: user.id, articleId: articleRaw.id } },
    }),
  ]);

  const { topicCluster } = articleRaw;

  // Use cached summary if available (no wait). If not cached, the
  // Suspense child will enrich and stream the summary in.
  const cachedKeyPoints = safeParseJson<string[]>(articleRaw.keyPointsJson, []);
  const hasCachedSummary =
    cachedKeyPoints.length > 0 && articleRaw.summaryLong.length > 120;

  const aiProvider = (process.env.AI_PROVIDER || "mock").toLowerCase();
  const hasRealAI =
    (aiProvider === "openai" && !!process.env.OPENAI_API_KEY) ||
    (aiProvider === "anthropic" && !!process.env.ANTHROPIC_API_KEY);

  return (
    <div className="container grid gap-6 py-6 sm:py-8 lg:grid-cols-[1fr_380px] lg:gap-8">
      <article className="min-w-0 space-y-6 sm:space-y-8">
        {/* ──────── Phase 1: renders instantly ──────── */}

        {/* Header */}
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            <Link href="/feed" className="text-ink-muted hover:text-ink">
              ← Feed
            </Link>
            <span>·</span>
            <span className="font-medium text-ink-muted">{articleRaw.source.name}</span>
            {articleRaw.source.trustTier === "state-affiliated" && (
              <span className="chip text-accent-warn">state-affiliated</span>
            )}
            <span>·</span>
            <span>{formatRelative(articleRaw.publishedAt)}</span>
            <span>·</span>
            <span>{formatDate(articleRaw.publishedAt)}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
            {articleRaw.headline}
          </h1>
          {topicCluster && (
            <Link href="/feed" className="inline-flex items-center gap-2 text-sm text-brand">
              #{topicCluster.label}
            </Link>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href={articleRaw.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <ExternalLink className="h-4 w-4" /> Read at {articleRaw.source.name}
            </a>
            <BookmarkButton articleId={articleRaw.id} initial={!!bookmark} size="md" />
            <ShareButton url={articleRaw.url} headline={articleRaw.headline} />
          </div>
        </header>

        {/* Hero image */}
        {articleRaw.imageUrl && (
          <div className="overflow-hidden rounded-2xl border border-line bg-bg-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={articleRaw.imageUrl}
              alt=""
              className="max-h-[420px] w-full object-cover"
              loading="eager"
            />
          </div>
        )}

        {/* Tabbed content: Analysis | Read | Source */}
        <ArticleReader
          articleUrl={articleRaw.url}
          articleText={articleRaw.articleText || articleRaw.previewText || articleRaw.summaryLong || ""}
          sourceName={articleRaw.source.name}
          analysisContent={
            <>
              {!hasRealAI && (
                <div className="mb-6 rounded-xl border border-dashed border-line bg-bg-subtle p-3 text-xs text-ink-muted">
                  <span className="font-medium text-ink">Mock AI mode.</span> Set{" "}
                  <code className="rounded bg-bg-elevated px-1">AI_PROVIDER=anthropic</code> and{" "}
                  <code className="rounded bg-bg-elevated px-1">ANTHROPIC_API_KEY=…</code> in env vars for real AI.
                </div>
              )}
              <Suspense fallback={<LoadingAnalysis />}>
                <AIAnalysisAsync
                  articleRaw={articleRaw}
                  topicCluster={topicCluster}
                  hasCachedSummary={hasCachedSummary}
                />
              </Suspense>
            </>
          }
        />
      </article>

      <aside className="space-y-6 lg:sticky lg:top-16 lg:h-fit lg:self-start">
        <ChatPanel articleId={articleRaw.id} articleHeadline={articleRaw.headline} />
        {/* Suggested questions stream in alongside the analysis */}
        <Suspense fallback={null}>
          <SuggestedQuestionsAsync articleId={articleRaw.id} />
        </Suspense>
      </aside>
    </div>
  );
}

/* ──────── Async child: does ALL the slow AI work ──────── */

async function AIAnalysisAsync({
  articleRaw,
  topicCluster,
  hasCachedSummary,
}: {
  articleRaw: Awaited<ReturnType<typeof db.article.findUnique>> & {
    source: Awaited<ReturnType<typeof db.source.findUnique>>;
  };
  topicCluster: any;
  hasCachedSummary: boolean;
}) {
  if (!articleRaw) return null;
  const { topicCluster: _ignore, ...articleBase } = articleRaw as any;

  // Lazy AI summary — cached after first view.
  const article = await enrichArticleSummary(articleBase);
  const keyPoints = safeParseJson<string[]>(article.keyPointsJson, []);
  const topicTags = safeParseJson<string[]>(article.topicTagsJson, []);

  // Related coverage + synthesis
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
  try {
    const relatedSet = await findRelatedArticles(article, { limit: 6 });
    related = relatedSet.related.map((r) => r.article);
    contrarianArticles = relatedSet.contrarian.map((r) => r.article);
    const bundle = await enrichArticleAnalysis(article, relatedSet);
    comparative = bundle.synthesis;
    contrarian = bundle.contrarian;
  } catch (err) {
    console.warn("[article] related/synthesis failed:", (err as Error).message);
  }

  // Timeline
  const topicLabel = topicCluster?.label ?? article.headline;
  let timeline: Array<{
    date: string;
    title: string;
    description: string;
    sources: Array<{ url: string; label: string }>;
  }> = [];
  try {
    if (topicCluster?.timelineEvents?.length > 0) {
      timeline = topicCluster.timelineEvents.map((e: any) => ({
        date: e.eventDate.toISOString(),
        title: e.title,
        description: e.description,
        sources: safeParseJson<Array<{ url: string; label: string }>>(e.sourceRefsJson, []),
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

  return (
    <>
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

      {/* Related coverage */}
      {related.length > 0 && (
        <Section title="Related coverage" subtitle="How other trusted sources are reporting this.">
          <div className="grid gap-3">
            {related.map((r: any) => (
              <Link key={r.id} href={`/article/${r.id}`} className="card card-hover block p-4">
                <div className="text-xs text-ink-faint">
                  {r.source.name} · {formatRelative(r.publishedAt)}
                </div>
                <div className="mt-1 font-medium">{r.headline}</div>
                <div className="mt-1 text-sm text-ink-muted line-clamp-2">{r.summaryShort}</div>
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
                      <a key={j} href={s.url} target="_blank" rel="noopener noreferrer" className="chip hover:text-ink">
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
    </>
  );
}

/* ──────── Suggested questions as a separate Suspense stream ──────── */

async function SuggestedQuestionsAsync({ articleId }: { articleId: string }) {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { source: true },
  });
  if (!article) return null;
  try {
    const suggestions = await ai.suggestedQuestions({
      topic: article.headline,
      headline: article.headline,
      summary: article.summaryShort || article.summaryLong,
    });
    if (!suggestions.questions || suggestions.questions.length === 0) return null;
    return (
      <SuggestedQuestions articleId={articleId} questions={suggestions.questions} />
    );
  } catch {
    return null;
  }
}

/* ──────── Loading indicator for the AI analysis phase ──────── */

function LoadingAnalysis() {
  return (
    <div className="space-y-6">
      <div className="card flex items-center gap-3 p-5">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
        <div>
          <div className="text-sm font-medium">Analyzing coverage across sources...</div>
          <div className="text-xs text-ink-muted">
            Finding related reporting, comparing viewpoints, and generating synthesis.
          </div>
        </div>
      </div>
      <AIAnalysisSkeleton />
    </div>
  );
}

/* ──────── Utility sub-components ──────── */

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
