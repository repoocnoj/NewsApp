/**
 * Overarching categories used to filter the feed and surface trending
 * topics. A category matches an article if any of its keywords appear in
 * the article's headline, short summary, or topic tags. The match is
 * intentionally coarse — the goal is to give users a quick filter bar,
 * not perfect classification.
 *
 * When AI enrichment has run for an article, its `topicTagsJson` will
 * also be checked directly against the keyword list, so you get the
 * benefit of the AI-assigned tags on top of keyword matching.
 */

export interface Category {
  slug: string;
  label: string;
  // Lowercase substrings we search for in the article's text.
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  {
    slug: "top",
    label: "Top stories",
    keywords: [],
  },
  {
    slug: "politics",
    label: "Politics",
    keywords: [
      "election","congress","senate","president","white house","parliament",
      "democrat","republican","gop","policy","minister","prime minister",
      "vote","campaign","administration","governor","lawmaker","ballot",
    ],
  },
  {
    slug: "business",
    label: "Business",
    keywords: [
      "market","stock","economy","fed","inflation","earnings","company",
      "business","ceo","bank","trade","tariff","finance","currency",
      "dollar","euro","ipo","merger","acquisition","wall street","nasdaq",
      "dow","s&p","treasury","bond","yield","interest rate",
    ],
  },
  {
    slug: "technology",
    label: "Technology",
    keywords: [
      "ai","artificial intelligence"," tech ","software","chip","semiconductor",
      "cloud","apple","google","microsoft","meta","openai","anthropic",
      "nvidia","startup","robot","cyber","hacker","data breach","algorithm",
      "social media","platform","smartphone","electric vehicle","ev ",
    ],
  },
  {
    slug: "world",
    label: "World",
    keywords: [
      "foreign","international","global","diplomat","treaty","sanction",
      "nato","united nations","embassy","summit","alliance","refugee",
    ],
  },
  {
    slug: "middle-east",
    label: "Middle East",
    keywords: [
      "iran","israel","gaza","hormuz","tehran","saudi","yemen","syria",
      "lebanon","hamas","hezbollah","west bank","netanyahu","houthi",
      "jerusalem","iraq","palestinian","kurdish","emirates","uae",
    ],
  },
  {
    slug: "europe",
    label: "Europe",
    keywords: [
      " europe","european union","eu ","brexit","ukraine","russia","putin",
      "zelensky","poland","germany","france","italy","spain","britain",
      " uk ","london","paris","berlin","kyiv","moscow",
    ],
  },
  {
    slug: "asia",
    label: "Asia",
    keywords: [
      "china","taiwan","japan","korea","asia","xi ","xi jinping","beijing",
      "hong kong","india","pakistan","vietnam","philippines","singapore",
      "tokyo","seoul","delhi",
    ],
  },
  {
    slug: "americas",
    label: "Americas",
    keywords: [
      "mexico","brazil","canada","argentina","venezuela","cuba","colombia",
      "chile","peru","haiti","caribbean","latin america","border",
      "immigration","cartel",
    ],
  },
  {
    slug: "conflict",
    label: "Conflict & Security",
    keywords: [
      " war ","military","troops","strike","missile","drone","attack",
      "killed","combat","offensive","terror","insurgent","rebel","ceasefire",
      "weapons","arms deal","defense",
    ],
  },
  {
    slug: "climate",
    label: "Climate & Energy",
    keywords: [
      "climate","warming","carbon","emission","fossil","renewable",
      "environment","solar","wind","electric vehicle","oil","gas ","opec",
      "pipeline","crude","barrel","coal","drought","flood","wildfire",
    ],
  },
  {
    slug: "health",
    label: "Health",
    keywords: [
      "health","medical","hospital","disease","virus","vaccine","drug",
      "fda","cancer","doctor","pandemic","outbreak","mental health","covid",
    ],
  },
  {
    slug: "science",
    label: "Science",
    keywords: [
      "science","research","study","space","nasa","physics","biology",
      "genetic","discovery","experiment","astronomy","quantum",
    ],
  },
];

/**
 * Test whether an article matches a given category, using lowercase
 * substring matching against the article's headline + short summary +
 * topic tags. "top" matches everything.
 */
export function articleMatchesCategory(
  article: {
    headline: string;
    summaryShort: string;
    topicTags: string[];
  },
  categorySlug: string,
): boolean {
  if (categorySlug === "top") return true;
  const cat = CATEGORIES.find((c) => c.slug === categorySlug);
  if (!cat) return true;
  const haystack = (
    article.headline +
    " " +
    article.summaryShort +
    " " +
    article.topicTags.join(" ")
  ).toLowerCase();
  return cat.keywords.some((kw) => haystack.includes(kw));
}

/**
 * Count how many articles match each category. Used to render chip
 * counts in the category bar and to pick "trending" categories.
 */
export function countPerCategory(
  articles: Array<{
    headline: string;
    summaryShort: string;
    topicTags: string[];
    publishedAt: Date;
  }>,
  opts: { since?: Date } = {},
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const cat of CATEGORIES) counts[cat.slug] = 0;
  const since = opts.since?.getTime() ?? 0;
  for (const a of articles) {
    if (a.publishedAt.getTime() < since) continue;
    counts.top++;
    for (const cat of CATEGORIES) {
      if (cat.slug === "top") continue;
      if (articleMatchesCategory(a, cat.slug)) counts[cat.slug]++;
    }
  }
  return counts;
}

/**
 * Build a list of trending named-entity / phrase chips from the recent
 * corpus. Extracts multi-word proper nouns and ranks by frequency.
 * Good for a "Trending now" strip above the main category bar.
 */
export function computeTrendingEntities(
  articles: Array<{ headline: string; summaryShort: string; publishedAt: Date }>,
  opts: { limit?: number; since?: Date } = {},
): Array<{ label: string; count: number }> {
  const limit = opts.limit ?? 8;
  const since = opts.since?.getTime() ?? 0;
  const counts = new Map<string, number>();
  const STOP = new Set([
    "The","A","An","This","That","These","Those","However","Meanwhile",
    "Reuters","Ap","Associated","Press","Bbc","Npr","Cnn","Fox","Nbc",
    "News","Today","Yesterday","Monday","Tuesday","Wednesday","Thursday",
    "Friday","Saturday","Sunday","January","February","March","April",
    "May","June","July","August","September","October","November","December",
    "President","Prime","Minister","Senator","Representative","Mr","Mrs",
    "Ms","Dr","Us","Uk","Eu","Un",
  ]);
  for (const a of articles) {
    if (a.publishedAt.getTime() < since) continue;
    const text = a.headline + " " + a.summaryShort;
    const matches = text.match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b/g) ?? [];
    for (const raw of matches) {
      const phrase = raw.trim();
      if (phrase.length < 4) continue;
      // Skip single words unless they look like a prominent name/place
      const parts = phrase.split(/\s+/);
      if (parts.length === 1 && STOP.has(phrase)) continue;
      if (parts.length === 1 && phrase.length < 5) continue;
      // Prefer multi-word phrases; count them 1.5x
      const weight = parts.length > 1 ? 1.5 : 1;
      counts.set(phrase, (counts.get(phrase) ?? 0) + weight);
    }
  }
  return Array.from(counts.entries())
    .filter(([k, v]) => v >= 2 && !STOP.has(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count: Math.round(count) }));
}
