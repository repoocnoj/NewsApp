# NewsApp

A truth-seeking, evidence-driven personalized news reader.

NewsApp combines trusted user-selected sources, other credible sources,
contrarian viewpoints, AI summaries, topic timelines, and conversational
AI over articles — with transparent citation back to source material.

It is **not** a generic news portal. It is designed to help a reader get
as close as possible to ground truth on a story by surfacing what is
corroborated, what is disputed, and what is missing.

---

## What's in the box

**Core experience**
- Landing page and dev-friendly email sign-in
- 3-step onboarding (topics → sources → like/dislike sample articles)
- Personalized home feed (recency × topic match × source preferences × signals)
- Article detail page with:
  - AI summary + key points + entities + topic tags
  - Article preview and link to original source
  - Related coverage from other trusted sources
  - **Agreement vs. disagreement** synthesis across sources
  - **Contrarian view** section from state-affiliated / geopolitically distinct outlets (clearly labeled)
  - Timeline of major events with cited sources
  - Suggested follow-up questions
  - Chat over the article and related coverage, grounded in source content
- Bookmarks / saved page
- Search across headlines, summaries, and topic tags
- Settings page to tune followed topics and source preferences

**Backend**
- Next.js 15 App Router (server components + server actions + route handlers)
- TypeScript across the stack
- Prisma ORM, SQLite by default (switchable to Postgres via `DATABASE_URL`)
- Provider-agnostic AI service (`OpenAIProvider`, `AnthropicProvider`, `MockProvider`)
- Source ingestion framework with pluggable adapters (RSS + mockable)
- Seeded dataset of sources, articles, topic clusters, timeline events — so the app is fully usable out of the box with no network calls and no API keys

---

## Setup

Prerequisites: **Node 18+** (tested on Node 22).

```bash
# 1. Install
npm install

# 2. Initialize the database (SQLite by default)
npm run db:push

# 3. Seed with demo sources, articles, topic clusters, and AI-enriched summaries
npm run db:seed

# 4. Start the dev server
npm run dev
# → http://localhost:3000
```

Sign in with any email on `/signin` to create a local account (dev-friendly,
passwordless). A seeded demo account exists at `demo@newsapp.local` — sign in
with that email to skip onboarding and jump straight to a populated feed.

### Environment variables

Copy `.env.example` → `.env` (there is already a working `.env` committed for
dev convenience) and adjust:

| Variable            | Purpose                                                        | Default              |
| ------------------- | -------------------------------------------------------------- | -------------------- |
| `DATABASE_URL`      | Prisma connection string                                       | `file:./dev.db`      |
| `NEXTAUTH_SECRET`   | Cookie signing / future Auth.js integration                    | `dev-secret-change-me` |
| `NEXTAUTH_URL`      | Base URL                                                       | `http://localhost:3000` |
| `AI_PROVIDER`       | `"mock"` \| `"openai"` \| `"anthropic"`                        | `mock`               |
| `OPENAI_API_KEY`    | Required when `AI_PROVIDER=openai`                             | —                    |
| `ANTHROPIC_API_KEY` | Required when `AI_PROVIDER=anthropic`                          | —                    |
| `AI_MODEL`          | Optional model override for either provider                    | sensible defaults    |
| `INGEST_LIVE`       | Set to `"1"` to attempt live RSS ingestion in `npm run ingest` | `0`                  |

If neither API key is set, the app automatically falls back to the
`MockProvider`, which produces deterministic, structured content from the
input. This means **every AI-driven surface works end-to-end with zero
configuration** — for development, demos, and tests.

### Useful scripts

```bash
npm run dev        # Start the Next.js dev server
npm run build      # Type-check + production build
npm run start      # Run the built app
npm run db:push    # Sync Prisma schema to the database
npm run db:seed    # Re-run the seed script (idempotent)
npm run db:reset   # Force-reset the DB and re-seed
npm run ingest     # Run the ingestion runner (honors INGEST_LIVE)
npm run test       # Run the Vitest suite
```

---

## Using the app

1. Open `http://localhost:3000`.
2. Click **Get started** → sign in with any email (e.g. `you@local.test`) or
   use the seeded `demo@newsapp.local` to skip onboarding.
3. Complete onboarding: pick 2+ topics, mark preferred/excluded sources, and
   like/dislike a few sample articles.
4. Explore your personalized feed. Click any article to open the detail page.
5. On the article page:
   - Read the AI summary, key points, and tags.
   - Scan **related coverage** from other trusted sources.
   - Open the **Agreement vs. disagreement** synthesis.
   - See the **contrarian view** with alternative framing from
     state-affiliated / geopolitically distinct outlets (labeled as such).
   - Walk the **timeline** of events.
   - Click a **suggested question** to push it into the chat panel.
   - Ask your own questions — the assistant is grounded in the article and
     related coverage and will flag when sources disagree.
6. Bookmark articles with the bookmark icon. Saved articles live under
   **Saved** in the nav.
7. Search from the **Search** tab — try `Hormuz`, `oil`, `AI regulation`, or `Iran`.
8. Tune preferences under **Settings** at any time.

### Example experience

The seeded data includes a **"Iran–US tensions and the Strait of Hormuz"**
topic cluster with articles from Reuters, AP, BBC, NPR, Bloomberg, WSJ,
Al Jazeera, Tehran Times, and RT — plus a multi-year timeline (Vincennes
1988 → tanker attacks 2019 → Soleimani 2020 → recent flashpoints). Open any
article in this cluster to see the full "side-by-side coverage + contrarian
view + timeline + chat" experience.

---

## Architecture notes

```
src/
  app/                        Next.js App Router pages + server actions
    page.tsx                  Landing
    signin/                   Dev-friendly email sign-in
    onboarding/               3-step onboarding (topics, sources, signals)
    feed/                     Personalized home feed
    article/[id]/             Article detail page (core experience)
    bookmarks/                Saved
    search/                   Search
    settings/                 Preferences
    api/
      auth/signout/           Sign out handler
      chat/                   Grounded chat over article + related coverage
  components/
    header-nav.tsx
    article-card.tsx          Feed + bookmarks + search card
    bookmark-button.tsx
    chat-panel.tsx            Client-side chat UI (calls /api/chat)
    suggested-questions.tsx   Pushes questions into the chat panel
  lib/
    db.ts                     Prisma client singleton
    session.ts                Minimal cookie-based session (swap for Auth.js)
    feed.ts                   Personalized ranking (explainable scoring)
    utils.ts
    ai/
      index.ts                High-level AI service (summarize/compare/...)
      types.ts                Provider-agnostic types
      providers/
        mock.ts               Deterministic, no-API-key fallback
        openai.ts             OpenAI chat completions
        anthropic.ts          Anthropic messages API
    ingest/
      types.ts                RawArticle + SourceAdapter
      rss.ts                  Generic RSS adapter
      runner.ts               `upsertRawArticle` + live ingestion
      seed-data.ts            Sources, clusters, articles, timeline
prisma/
  schema.prisma               Data model
  seed.ts                     Idempotent seed script
scripts/
  ingest.ts                   Entry point for `npm run ingest`
tests/
  utils.test.ts
  ai-mock.test.ts
  feed-ranking.test.ts
```

### Swapping the AI provider

```ts
// .env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
```

or

```ts
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-6
```

All AI features use structured (JSON) outputs where meaningful and the
service layer parses defensively. If the live provider fails, the
experience degrades gracefully (empty sections render or the mock fallback
is used during seeding).

### Switching to Postgres

1. Change `provider` in `prisma/schema.prisma` to `postgresql`.
2. Set `DATABASE_URL` to your Postgres connection string.
3. Run `npm run db:push && npm run db:seed`.

The schema is Postgres-compatible; JSON columns are stored as strings for
SQLite compatibility and are parsed defensively on read.

### Deploying

- App layer deploys cleanly to Vercel.
- Use a Postgres-compatible database (Neon, Supabase, RDS) in production.
- Set the environment variables above in your deployment target.
- Run `prisma migrate deploy` as part of your build.

---

## What's mocked or simulated

This MVP intentionally keeps the runnable surface complete rather than
solving every integration perfectly. The following pieces are simulated or
can be simulated:

- **Live article ingestion.** The `RSS` adapter is real and works (see
  `src/lib/ingest/rss.ts`), but running it hits external feeds. For a
  zero-friction dev experience, `npm run ingest` is a no-op unless
  `INGEST_LIVE=1` is set, and the seeded dataset is used instead. The seed
  includes a curated, topically coherent mix of articles so the related
  coverage / contrarian view / timeline sections render meaningfully.
- **Paywalled sources** (NYT, WSJ, Bloomberg, FT, Economist, Foreign
  Affairs). Seeded as `ingestStrategy: "mock"`. The architecture is ready
  for authenticated or partner-API ingestion; adding one is a new adapter
  implementing `SourceAdapter`.
- **State-affiliated / contrarian sources** (Tehran Times, RT). Also
  seeded. Articles are labeled as `state-affiliated` and surfaced in the
  Contrarian View section with a visible disclaimer.
- **AI provider.** The default `AI_PROVIDER=mock` generates deterministic,
  structured content so every AI surface renders end-to-end. Set an API
  key and flip the provider to `openai` or `anthropic` for real generation.
- **Auth.** A minimal cookie-based session (no password, email upsert) is
  used so the app is runnable instantly. The `requireUser()` /
  `getCurrentUser()` boundary is the only place to swap in NextAuth /
  Auth.js later.

---

## Recommended next steps (for production)

- Swap the dev session layer for Auth.js with a magic-link or OAuth provider.
- Move AI synthesis caching onto the `TopicCluster` and `Article` rows
  (current code re-synthesizes on each page load for simplicity; add a
  cache column + invalidation on new ingest).
- Add embeddings-based related article retrieval (schema is ready: add a
  `vector` column in Postgres + an adapter over pgvector or Pinecone).
- Productionize ingestion: move `runLiveIngestion` behind a cron or
  durable queue (Vercel Cron / Inngest / Trigger.dev).
- Build out real adapters for paywalled partners where licensing allows.
- Expand the test suite to cover route handlers and DB interactions with
  a fresh test database per run.

---

## License

MIT. Articles and summaries are for informational purposes; respect source
publishers' terms of use when configuring ingestion.
