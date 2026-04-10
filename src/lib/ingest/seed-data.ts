/**
 * Seed data that powers a coherent end-to-end experience without
 * relying on live external feeds. Articles are grouped into topic
 * clusters so the "related coverage", "agreement vs. disagreement",
 * "contrarian view", and "timeline" features all render with real
 * content on first boot.
 */

export interface SeedSource {
  slug: string;
  name: string;
  homepageUrl: string;
  rssUrl?: string;
  region: string;
  trustTier: "high" | "mixed" | "state-affiliated" | "opinion";
  perspectiveTags: string[];
  ingestStrategy: "rss" | "mock";
}

export interface SeedArticle {
  sourceSlug: string;
  clusterSlug: string;
  url: string;
  headline: string;
  author: string;
  publishedAt: string; // ISO
  articleText: string;
  imageUrl?: string;
}

export interface SeedCluster {
  slug: string;
  label: string;
  canonicalQuestion: string;
  summary: string;
}

export interface SeedTimelineEvent {
  clusterSlug: string;
  eventDate: string; // ISO
  title: string;
  description: string;
  sourceRefs: Array<{ url: string; label: string }>;
}

export const SOURCES: SeedSource[] = [
  // ---------- Global wires (gold standard, mostly open) ----------
  // Reuters retired their public RSS years ago (feeds.reuters.com is
  // dead). AP's RSS URLs move frequently and often return 404. Both
  // remain in the source list for categorization and manual pointing,
  // but are marked `mock` so live ingestion skips them until a licensed
  // integration (Reuters Connect, AP's API) is wired up.
  {
    slug: "reuters",
    name: "Reuters",
    homepageUrl: "https://www.reuters.com",
    region: "global",
    trustTier: "high",
    perspectiveTags: ["wire", "center"],
    ingestStrategy: "mock",
  },
  {
    slug: "ap",
    name: "Associated Press",
    homepageUrl: "https://apnews.com",
    region: "global",
    trustTier: "high",
    perspectiveTags: ["wire", "center"],
    ingestStrategy: "mock",
  },
  {
    slug: "afp",
    name: "Agence France-Presse",
    homepageUrl: "https://www.afp.com/en",
    region: "global",
    trustTier: "high",
    perspectiveTags: ["wire", "center"],
    ingestStrategy: "mock",
  },

  // ---------- Public / international broadcasters ----------
  {
    slug: "bbc",
    name: "BBC News",
    homepageUrl: "https://www.bbc.com/news",
    rssUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
    region: "uk",
    trustTier: "high",
    perspectiveTags: ["public", "center"],
    ingestStrategy: "rss",
  },
  {
    slug: "npr",
    name: "NPR",
    homepageUrl: "https://www.npr.org",
    rssUrl: "https://feeds.npr.org/1004/rss.xml",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["public", "center-left"],
    ingestStrategy: "rss",
  },
  {
    slug: "pbs-newshour",
    name: "PBS NewsHour",
    homepageUrl: "https://www.pbs.org/newshour",
    rssUrl: "https://www.pbs.org/newshour/feeds/rss/headlines",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["public", "center"],
    ingestStrategy: "rss",
  },
  {
    slug: "dw",
    name: "Deutsche Welle",
    homepageUrl: "https://www.dw.com/en",
    rssUrl: "https://rss.dw.com/rdf/rss-en-all",
    region: "germany",
    trustTier: "high",
    perspectiveTags: ["public", "center"],
    ingestStrategy: "rss",
  },
  {
    slug: "france24",
    name: "France 24",
    homepageUrl: "https://www.france24.com/en",
    rssUrl: "https://www.france24.com/en/rss",
    region: "france",
    trustTier: "high",
    perspectiveTags: ["public", "center"],
    ingestStrategy: "rss",
  },

  // ---------- Major US newspapers ----------
  {
    slug: "nyt",
    name: "New York Times",
    homepageUrl: "https://www.nytimes.com",
    rssUrl: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["center-left"],
    ingestStrategy: "rss",
  },
  {
    slug: "washington-post",
    name: "The Washington Post",
    homepageUrl: "https://www.washingtonpost.com",
    rssUrl: "https://feeds.washingtonpost.com/rss/world",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["center-left"],
    ingestStrategy: "rss",
  },
  {
    slug: "wsj",
    name: "Wall Street Journal",
    homepageUrl: "https://www.wsj.com",
    rssUrl: "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["center-right", "business"],
    ingestStrategy: "rss",
  },
  {
    slug: "la-times",
    name: "Los Angeles Times",
    homepageUrl: "https://www.latimes.com",
    rssUrl: "https://www.latimes.com/world-nation/rss2.0.xml",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["center-left"],
    ingestStrategy: "rss",
  },
  {
    slug: "the-guardian",
    name: "The Guardian",
    homepageUrl: "https://www.theguardian.com",
    rssUrl: "https://www.theguardian.com/world/rss",
    region: "uk",
    trustTier: "high",
    perspectiveTags: ["center-left"],
    ingestStrategy: "rss",
  },

  // ---------- Business / finance ----------
  {
    slug: "bloomberg",
    name: "Bloomberg",
    homepageUrl: "https://www.bloomberg.com",
    region: "global",
    trustTier: "high",
    perspectiveTags: ["business", "center"],
    ingestStrategy: "mock",
  },
  {
    slug: "ft",
    name: "Financial Times",
    homepageUrl: "https://www.ft.com",
    rssUrl: "https://www.ft.com/world?format=rss",
    region: "uk",
    trustTier: "high",
    perspectiveTags: ["business", "center"],
    ingestStrategy: "rss",
  },
  {
    slug: "economist",
    name: "The Economist",
    homepageUrl: "https://www.economist.com",
    rssUrl: "https://www.economist.com/international/rss.xml",
    region: "uk",
    trustTier: "high",
    perspectiveTags: ["center-right", "analysis"],
    ingestStrategy: "rss",
  },
  {
    slug: "cnbc",
    name: "CNBC",
    homepageUrl: "https://www.cnbc.com",
    rssUrl: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["business", "center"],
    ingestStrategy: "rss",
  },

  // ---------- Long-form / analysis / policy ----------
  {
    slug: "the-atlantic",
    name: "The Atlantic",
    homepageUrl: "https://www.theatlantic.com",
    rssUrl: "https://www.theatlantic.com/feed/all/",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["analysis", "center-left"],
    ingestStrategy: "rss",
  },
  {
    slug: "new-yorker",
    name: "The New Yorker",
    homepageUrl: "https://www.newyorker.com",
    rssUrl: "https://www.newyorker.com/feed/news",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["analysis", "center-left"],
    ingestStrategy: "rss",
  },
  {
    slug: "foreign-affairs",
    name: "Foreign Affairs",
    homepageUrl: "https://www.foreignaffairs.com",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["analysis", "policy"],
    ingestStrategy: "mock",
  },
  {
    slug: "foreign-policy",
    name: "Foreign Policy",
    homepageUrl: "https://foreignpolicy.com",
    rssUrl: "https://foreignpolicy.com/feed/",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["analysis", "policy"],
    ingestStrategy: "rss",
  },
  {
    slug: "propublica",
    name: "ProPublica",
    homepageUrl: "https://www.propublica.org",
    rssUrl: "https://www.propublica.org/feeds/propublica/main",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["investigative", "center"],
    ingestStrategy: "rss",
  },
  {
    slug: "axios",
    name: "Axios",
    homepageUrl: "https://www.axios.com",
    rssUrl: "https://api.axios.com/feed/",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["brief", "center"],
    ingestStrategy: "rss",
  },
  {
    slug: "politico",
    name: "Politico",
    homepageUrl: "https://www.politico.com",
    rssUrl: "https://rss.politico.com/politics-news.xml",
    region: "us",
    trustTier: "high",
    perspectiveTags: ["politics", "center"],
    ingestStrategy: "rss",
  },

  // ---------- Regional / alternative perspective (clearly labeled) ----------
  {
    slug: "aljazeera",
    name: "Al Jazeera English",
    homepageUrl: "https://www.aljazeera.com",
    rssUrl: "https://www.aljazeera.com/xml/rss/all.xml",
    region: "qatar",
    trustTier: "mixed",
    perspectiveTags: ["regional", "middle-east"],
    ingestStrategy: "rss",
  },
  {
    slug: "tehran-times",
    name: "Tehran Times",
    homepageUrl: "https://www.tehrantimes.com",
    region: "iran",
    trustTier: "state-affiliated",
    perspectiveTags: ["state-affiliated", "regional", "iran"],
    ingestStrategy: "mock",
  },
  {
    slug: "rt",
    name: "RT",
    homepageUrl: "https://www.rt.com",
    rssUrl: "https://www.rt.com/rss/news/",
    region: "russia",
    trustTier: "state-affiliated",
    perspectiveTags: ["state-affiliated", "contrarian"],
    ingestStrategy: "rss",
  },
];

export const CLUSTERS: SeedCluster[] = [
  {
    slug: "iran-us-hormuz-incident",
    label: "Iran–US tensions and the Strait of Hormuz",
    canonicalQuestion:
      "What happened in the reported US helicopter incident involving Iran, and what is the significance of the Strait of Hormuz?",
    summary:
      "Coverage of a reported incident involving US military activity near the Strait of Hormuz, Iranian reactions, and the strategic importance of the strait to global oil supply.",
  },
  {
    slug: "global-oil-supply",
    label: "Global oil supply and OPEC policy",
    canonicalQuestion: "How is global oil supply being shaped by OPEC and geopolitical risks?",
    summary: "Reporting on OPEC+ production decisions, US shale output, and geopolitical risks to oil supply chains.",
  },
  {
    slug: "ai-regulation",
    label: "AI regulation and frontier model policy",
    canonicalQuestion: "How are governments approaching the regulation of frontier AI models?",
    summary: "Reporting on AI policy debates in the US, EU, and UK, including frontier model evaluations and safety commitments.",
  },
];

const IRAN_CLUSTER = "iran-us-hormuz-incident";

export const ARTICLES: SeedArticle[] = [
  // ---------- Iran/Hormuz cluster ----------
  {
    sourceSlug: "reuters",
    clusterSlug: IRAN_CLUSTER,
    url: "https://example.com/reuters/iran-us-helicopter-incident",
    headline: "US helicopter reported in incident near Strait of Hormuz; Iran denies provocation",
    author: "Reuters Staff",
    publishedAt: daysAgo(2),
    articleText:
      "A US military helicopter was involved in a reported incident near the Strait of Hormuz on Tuesday, according to US defense officials cited by Reuters. The officials said the aircraft was operating in international airspace and that no American personnel were injured. Iran's foreign ministry denied any provocation and said its forces had not targeted the aircraft. The Strait of Hormuz, a narrow waterway between Iran and the Arabian Peninsula, handles roughly a fifth of the world's oil trade, making any security incident there closely watched by energy markets. Oil prices edged higher in early trading on Wednesday as traders assessed the risk of further escalation. Analysts said the incident adds to a string of flashpoints in the region over the past year, but cautioned that neither side appeared to be seeking a broader confrontation.",
  },
  {
    sourceSlug: "ap",
    clusterSlug: IRAN_CLUSTER,
    url: "https://example.com/ap/pentagon-iran-helicopter",
    headline: "Pentagon confirms incident near Hormuz involving US aircraft",
    author: "Associated Press",
    publishedAt: daysAgo(2),
    articleText:
      "The Pentagon confirmed Tuesday that a US military aircraft was involved in an incident near the Strait of Hormuz, declining to provide further operational details. Defense officials said the situation was being reviewed and that the US maintained its commitment to freedom of navigation in the region. Iranian state media reported no direct engagement from Iranian forces. The Strait of Hormuz is one of the world's most strategically important waterways for oil transit. Regional analysts said the episode is consistent with a pattern of near-miss incidents over the past several years rather than a deliberate escalation.",
  },
  {
    sourceSlug: "bbc",
    clusterSlug: IRAN_CLUSTER,
    url: "https://example.com/bbc/hormuz-us-iran",
    headline: "What we know about the reported Hormuz incident",
    author: "BBC News",
    publishedAt: daysAgo(1),
    articleText:
      "Reports of an incident involving a US helicopter and Iranian forces near the Strait of Hormuz have prompted questions about what actually happened. According to US officials, the helicopter was conducting a routine patrol; Tehran has rejected any suggestion that Iranian assets were involved. The BBC has not independently verified claims from either side. The Strait of Hormuz is the exit route for most oil produced by Gulf states; roughly 20% of global oil consumption passes through it. Analysts say the repeated flashpoints in the strait reflect a broader standoff between Tehran and Washington over sanctions and Iran's nuclear programme.",
  },
  {
    sourceSlug: "npr",
    clusterSlug: IRAN_CLUSTER,
    url: "https://example.com/npr/hormuz-oil-significance",
    headline: "Why the Strait of Hormuz matters — and what the latest incident tells us",
    author: "NPR",
    publishedAt: daysAgo(1),
    articleText:
      "The Strait of Hormuz is just 21 miles wide at its narrowest point, but it is the single most important chokepoint in the global oil trade. Any incident involving US and Iranian forces there immediately ripples through energy markets. Tuesday's reported encounter was relatively contained, but analysts say the fact that it occurred at all highlights how quickly tensions can escalate. The EIA estimates that more than 20 million barrels per day of oil flowed through the strait last year — a volume that cannot be fully rerouted by existing pipelines. NPR spoke with regional experts about the historical context of US-Iran tensions, including the 1988 Vincennes incident and the 2019 tanker attacks.",
  },
  {
    sourceSlug: "bloomberg",
    clusterSlug: IRAN_CLUSTER,
    url: "https://example.com/bloomberg/oil-markets-react",
    headline: "Oil rises as traders price in Hormuz risk premium",
    author: "Bloomberg News",
    publishedAt: daysAgo(2),
    articleText:
      "Brent crude climbed on Wednesday as traders added a risk premium to oil prices following reports of a security incident near the Strait of Hormuz. Volatility in energy markets has increased over the past week amid heightened regional tensions. Analysts at major banks said a sustained disruption to Hormuz transit would be one of the few events capable of pushing oil into triple digits. The US Energy Information Administration lists Hormuz as the world's most important oil chokepoint.",
  },
  {
    sourceSlug: "wsj",
    clusterSlug: IRAN_CLUSTER,
    url: "https://example.com/wsj/hormuz-strategic-risk",
    headline: "Hormuz incident renews focus on strategic chokepoint",
    author: "WSJ Staff",
    publishedAt: daysAgo(1),
    articleText:
      "The reported encounter near the Strait of Hormuz has renewed focus on one of the most strategically important maritime corridors in the world. The Wall Street Journal reviewed US Navy statements and regional analyst assessments. Officials emphasized that freedom of navigation operations would continue. The article discusses alternative export routes that could partially mitigate a disruption but notes they have insufficient capacity to replace Hormuz flows.",
  },
  {
    sourceSlug: "aljazeera",
    clusterSlug: IRAN_CLUSTER,
    url: "https://example.com/aljazeera/iran-denies-hormuz",
    headline: "Iran rejects US account of Hormuz incident",
    author: "Al Jazeera",
    publishedAt: daysAgo(1),
    articleText:
      "Iranian officials rejected Washington's account of an incident near the Strait of Hormuz, calling US claims 'unfounded.' A foreign ministry spokesperson said Iran's armed forces had not engaged any US aircraft and accused Washington of using incidents in the Gulf to justify a continued military presence. The piece places the episode in the context of what it calls a long-running US campaign of pressure against Iran. Regional analysts quoted in the story argued that the incident fits a pattern of narrative contestation rather than confirmed physical escalation.",
  },
  {
    sourceSlug: "tehran-times",
    clusterSlug: IRAN_CLUSTER,
    url: "https://example.com/tehran-times/us-provocation",
    headline: "Tehran accuses US of provocation in Gulf airspace",
    author: "Tehran Times",
    publishedAt: daysAgo(1),
    articleText:
      "Tehran Times reported that Iranian officials accused the United States of provocation in Gulf airspace after Washington's account of an aerial incident near the Strait of Hormuz. The piece frames the US military presence as the underlying source of regional instability and cites unnamed Iranian defense officials who reject any Iranian engagement with the US aircraft. The article echoes official statements emphasizing Iran's sovereignty and questions the credibility of US accounts of Gulf incidents.",
  },
  {
    sourceSlug: "rt",
    clusterSlug: IRAN_CLUSTER,
    url: "https://example.com/rt/hormuz-us-narrative",
    headline: "Hormuz incident: another chapter in Washington's pressure campaign?",
    author: "RT",
    publishedAt: daysAgo(1),
    articleText:
      "RT's analysis argues that the Hormuz incident should be read within a broader US 'pressure campaign' against Iran. The piece criticizes Western media framing and argues that the lack of independent verification makes the US account questionable. It highlights voices from Russia and Iran that caution against accepting the US narrative at face value.",
  },
  // ---------- Oil supply cluster ----------
  {
    sourceSlug: "reuters",
    clusterSlug: "global-oil-supply",
    url: "https://example.com/reuters/opec-production",
    headline: "OPEC+ signals steady output as markets eye Middle East risk",
    author: "Reuters",
    publishedAt: daysAgo(4),
    articleText:
      "OPEC+ signaled on Monday that it would hold production steady, even as traders focused on geopolitical risk from the Middle East. Analysts said the group has limited spare capacity and is wary of appearing to react to short-term political events. Oil markets remain sensitive to any sign of disruption in key transit chokepoints.",
  },
  {
    sourceSlug: "ft",
    clusterSlug: "global-oil-supply",
    url: "https://example.com/ft/shale-vs-opec",
    headline: "US shale producers see muted response to oil price moves",
    author: "FT Staff",
    publishedAt: daysAgo(5),
    articleText:
      "Even as oil prices rise on geopolitical risk, US shale producers have not materially increased drilling activity. Executives cited capital discipline and investor pressure for shareholder returns as the main constraints.",
  },
  {
    sourceSlug: "economist",
    clusterSlug: "global-oil-supply",
    url: "https://example.com/economist/oil-risk-premium",
    headline: "The mechanics of the Middle East risk premium in oil",
    author: "The Economist",
    publishedAt: daysAgo(6),
    articleText:
      "This analysis explains how geopolitical events in the Middle East translate into a risk premium in oil prices. It argues that the premium reflects market expectations about potential disruptions, not confirmed supply losses, and that chokepoints like the Strait of Hormuz remain structurally significant.",
  },
  // ---------- AI regulation cluster ----------
  {
    sourceSlug: "foreign-affairs",
    clusterSlug: "ai-regulation",
    url: "https://example.com/fa/frontier-ai",
    headline: "Governing frontier AI: the emerging international landscape",
    author: "Foreign Affairs",
    publishedAt: daysAgo(7),
    articleText:
      "This essay maps the emerging international landscape for frontier AI governance, focusing on voluntary commitments, evaluations, and mutual recognition between the US, UK, and EU. The authors argue that current arrangements are stop-gap measures and that durable governance will require binding commitments.",
  },
  {
    sourceSlug: "bbc",
    clusterSlug: "ai-regulation",
    url: "https://example.com/bbc/eu-ai-act",
    headline: "EU AI Act enters next compliance phase",
    author: "BBC",
    publishedAt: daysAgo(3),
    articleText:
      "The EU AI Act has entered its next phase of compliance obligations, with companies scrambling to document training data and risk assessments for high-risk systems.",
  },
  {
    sourceSlug: "wsj",
    clusterSlug: "ai-regulation",
    url: "https://example.com/wsj/frontier-model-audits",
    headline: "Big tech firms face audits of frontier models under new rules",
    author: "WSJ",
    publishedAt: daysAgo(3),
    articleText:
      "Large tech firms are preparing for external audits of their frontier models under new US and EU rules. Legal teams are focused on how audit findings will be disclosed.",
  },
];

export const TIMELINE_EVENTS: SeedTimelineEvent[] = [
  {
    clusterSlug: IRAN_CLUSTER,
    eventDate: isoYear(1988, 6, 3),
    title: "USS Vincennes shoots down Iran Air 655",
    description:
      "A US Navy cruiser mistakenly shot down a civilian Iranian airliner over the Strait of Hormuz during the Iran–Iraq war, killing 290 people. The incident remains a reference point for US–Iran tensions.",
    sourceRefs: [{ url: "https://example.com/reference/vincennes", label: "Reference" }],
  },
  {
    clusterSlug: IRAN_CLUSTER,
    eventDate: isoYear(2019, 6, 13),
    title: "Tanker attacks in the Gulf of Oman",
    description:
      "Two oil tankers were attacked near the Strait of Hormuz. The US blamed Iran; Tehran denied responsibility. The incident caused a sharp, short-lived jump in oil prices.",
    sourceRefs: [],
  },
  {
    clusterSlug: IRAN_CLUSTER,
    eventDate: isoYear(2020, 1, 3),
    title: "Killing of Qasem Soleimani",
    description:
      "A US strike killed Iranian general Qasem Soleimani in Baghdad, sharply escalating US–Iran tensions. Subsequent months saw retaliatory strikes and repeated near-misses in the Gulf.",
    sourceRefs: [],
  },
  {
    clusterSlug: IRAN_CLUSTER,
    eventDate: daysAgoIso(365),
    title: "Renewed flashpoints in the Gulf",
    description:
      "A series of incidents in the Gulf and around Hormuz over the past year keep the region on edge even as neither side signals an intent to escalate.",
    sourceRefs: [],
  },
  {
    clusterSlug: IRAN_CLUSTER,
    eventDate: daysAgoIso(2),
    title: "Reported US helicopter incident near Hormuz",
    description:
      "US officials confirm an incident near the Strait of Hormuz. Iran denies any involvement. Oil markets add a risk premium.",
    sourceRefs: [
      { url: "https://example.com/reuters/iran-us-helicopter-incident", label: "Reuters" },
      { url: "https://example.com/ap/pentagon-iran-helicopter", label: "AP" },
    ],
  },
];

/* ---------- helpers ---------- */

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysAgoIso(n: number): string {
  return daysAgo(n);
}
function isoYear(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}
