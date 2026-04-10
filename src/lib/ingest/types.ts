export interface RawArticle {
  url: string;
  headline: string;
  author?: string;
  publishedAt: Date;
  articleText: string;
  previewText?: string;
  imageUrl?: string;
}

export interface SourceAdapter {
  slug: string;
  fetch(): Promise<RawArticle[]>;
}
