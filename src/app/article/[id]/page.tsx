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

export const dynamic = "force-dynamic";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;
  const article = await db.article.findUnique({
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
  if (!article) return notFound();

  // Record view signal
  await db.articleSignal.upsert({
    where: { userId_articleId_kind: { userId: user.id, articleId: article.id, kind: "view" } },
    create: { userId: user.id, articleId: article.id, kind: "view" },
    update: {},
  });

  const bookmark = await db.bookmark.findUnique({
    where: { userId_articleId: { userId: user.id, articleId: article.id } },
  });

  // Gather related + contrarian articles through ArticleRelationship
  const relationships = await db.articleRelationship.findMany({
    where: { fromArticleId: article.id },
    include: {
      toArticle: { include: { source: true } },
    },
  });
  const related = relationships
    .filter((r) => r.relationshipType === "related")
    .map((r) => r.toArticle);
  const contrarianArticles = relationships
    .filter((r) => r.relationshipType === "contrarian")
    .map((r) => r.toArticle);

  // Kick off AI syntheses. These run server-side and their outputs are
  // intentionally not persisted for this MVP (computed each load). In
  // production, cache on the cluster or article row.
  const topicLabel = article.topicCluster?.label ?? article.headline;
  const [comparative, contrarian, timeline, suggestions] = await Promise.all([
    related.length
      ? ai.comparativeSynthesis({
          topic: topicLabel,
          articles: [article, ...related].map((a) => ({
            source: (a as any).source?.name ?? "Unknown",
            headline: a.headline,
            summary: a.summaryShort,
          })),
        })
      : Promise.resolve({
          commonFacts: [],
          disagreements: [],
          framingDifferences: [],
          missingContext: [],
        }),
    contrarianArticles.length
      ? ai.contrarianView({
          topic: topicLabel,
          mainstreamSummary: article.summaryShort,
          contrarianArticles: contrarianArticles.map((a) => ({
            source: (a as any).source?.name ?? "Unknown",
            headline: a.headline,
            url: a.url,
            summary: a.summaryShort,
          })),
        })
      : Promise.resolve({ summary: "", whyItDiffers: "", supportingUrls: [] }),
    article.topicCluster && article.topicCluster.timelineEvents.length
      ? Promise.resolve(
          article.topicCluster.timelineEvents.map((e) => ({
            date: e.eventDate.toISOString(),
            title: e.title,
            description: e.description,
            sources: safeParseJson<Array<{ url: string; label: string }>>(
              e.sourceRefsJson,
              [],
            ),
          })),
        )
      : ai.timeline({
          topic: topicLabel,
          articles: [article, ...related].map((a) => ({
            source: (a as any).source?.name ?? "Unknown",
            url: a.url,
            headline: a.headline,
            publishedAt: a.publishedAt.toISOString(),
            summary: a.summaryShort,
          })),
        }),
    ai.suggestedQuestions({
      topic: topicLabel,
      headline: article.headline,
      summary: article.summaryShort,
    }),
  ]);

  const keyPoints = safeParseJson<string[]>(article.keyPointsJson, []);
  const topicTags = safeParseJson<string[]>(article.topicTagsJson, []);

  return (
    <div className="container grid gap-8 py-8 lg:grid-cols-[1fr_380px]">
      <article className="space-y-8">
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
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {article.headline}
          </h1>
          {article.topicCluster && (
            <Link
              href={`/feed`}
              className="inline-flex items-center gap-2 text-sm text-brand"
            >
              #{article.topicCluster.label}
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

      <aside className="space-y-6 lg:sticky lg:top-16 lg:h-fit">
        <ChatPanel
          articleId={article.id}
          articleHeadline={article.headline}
        />
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
