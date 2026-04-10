/**
 * Lightweight text similarity for finding related articles across sources.
 *
 * Not embeddings — just tokenization + Jaccard over a weighted bag of
 * significant tokens. Good enough for cross-source clustering on a corpus
 * of a few hundred articles, and cheap enough to run inside a request.
 *
 * When the corpus grows past ~5k articles, swap this for an embedding-
 * based index (pgvector + a background job). The public API here
 * (`extractKeywords`, `similarityScore`) would stay the same.
 */

const STOPWORDS = new Set([
  "the","a","an","and","or","but","in","on","at","of","to","for","with","by",
  "from","as","is","was","are","were","been","be","being","have","has","had",
  "do","does","did","will","would","can","could","should","may","might",
  "that","this","these","those","it","its","they","them","their","there",
  "he","she","his","her","him","we","our","ours","you","your","yours","i",
  "my","me","mine","us","about","into","over","after","before","during",
  "between","against","through","when","while","which","who","what","where",
  "how","why","not","no","yes","so","than","then","too","very","just","also",
  "more","most","much","many","some","any","all","each","every","both","few",
  "other","another","such","own","same","only","than","up","down","out","off",
  "again","further","here","there","once","new","said","says","year","years",
  "week","day","days","today","yesterday","morning","evening","night","time",
  "times","says","told","according","one","two","three","last","first",
]);

/**
 * Normalize text → lowercase token set, stopwords removed.
 * Multi-token entity-like phrases (proper-noun sequences) are kept intact
 * and boosted so shared named entities drive the similarity score.
 */
export function extractKeywords(text: string): {
  tokens: Set<string>;
  entities: Set<string>;
} {
  const tokens = new Set<string>();
  const entities = new Set<string>();

  // Named-entity-like phrases: runs of 1-4 capitalized words in the RAW text.
  const entityRegex = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\b/g;
  for (const m of text.matchAll(entityRegex)) {
    const phrase = m[1].trim();
    if (phrase.length < 3) continue;
    // Filter out all-caps single words (often headlines/navigation noise).
    if (!phrase.includes(" ") && STOPWORDS.has(phrase.toLowerCase())) continue;
    entities.add(phrase.toLowerCase());
  }

  // Unigrams from lowercased text, stopwords removed.
  const cleaned = text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/);
  for (const w of cleaned) {
    if (w.length < 3 || w.length > 24) continue;
    if (STOPWORDS.has(w)) continue;
    if (/^\d+$/.test(w)) continue;
    tokens.add(w);
  }
  return { tokens, entities };
}

/**
 * Similarity score: weighted blend of unigram Jaccard + entity Jaccard.
 * Entities carry more weight because two articles sharing "Strait of
 * Hormuz" and "Tehran" are almost certainly about the same story, while
 * two articles sharing "report" and "statement" are not.
 */
export function similarityScore(
  a: { tokens: Set<string>; entities: Set<string> },
  b: { tokens: Set<string>; entities: Set<string> },
): number {
  const tokenScore = jaccard(a.tokens, b.tokens);
  const entityScore = jaccard(a.entities, b.entities);
  return 0.35 * tokenScore + 0.65 * entityScore;
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
