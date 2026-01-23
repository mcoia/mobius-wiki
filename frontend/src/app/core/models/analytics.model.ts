export interface OverallStats {
  period: string;
  views: {
    total: number;
    pagesViewed: number;
    uniqueUsers: number;
    uniqueSessions: number;
  };
  content: {
    wikis: number;
    sections: number;
    pages: number;
    files: number;
  };
}

export interface PopularPage {
  page: {
    id: number;
    title: string;
    slug: string;
  };
  section: {
    title: string;
    slug: string;
  };
  wiki: {
    title: string;
    slug: string;
  };
  viewCount: number;
  uniqueSessions: number;
}

export interface PopularPagesResponse {
  data: PopularPage[];
  meta: {
    limit: number;
    period: string;
  };
}

export interface DailyView {
  date: string;
  views: number;
  uniqueSessions: number;
}

export interface DailyViewsResponse {
  data: DailyView[];
  meta: {
    period: string;
  };
}

// Wiki Performance Stats
export interface WikiStats {
  wikiId: number;
  wikiTitle: string;
  wikiSlug: string;
  viewCount: number;
  uniqueSessions: number;
}

export interface WikiStatsResponse {
  data: WikiStats[];
  meta: {
    period: string;
  };
}

// Section Performance Stats
export interface SectionStats {
  sectionId: number;
  sectionTitle: string;
  wikiTitle: string;
  viewCount: number;
  uniqueSessions: number;
}

export interface SectionStatsResponse {
  data: SectionStats[];
  meta: {
    limit: number;
    period: string;
  };
}

// User Contributions
export interface UserContribution {
  userId: number;
  userName: string;
  editCount: number;
  pagesEdited: number;
}

export interface UserContributionsResponse {
  data: UserContribution[];
  meta: {
    limit: number;
    period: string;
  };
}

// Content Creation Trends
export interface CreationTrend {
  date: string;
  pagesCreated: number;
  versionsCreated: number;
}

export interface ContentTrendsResponse {
  data: CreationTrend[];
  meta: {
    period: string;
  };
}

// Content Health
export interface OrphanedPage {
  id: number;
  title: string;
  createdAt: string;
}

export interface StalePage {
  id: number;
  title: string;
  lastUpdated: string;
  daysSinceUpdate: number;
}

export interface DraftPage {
  id: number;
  title: string;
  createdAt: string;
}

export interface ContentHealth {
  orphanedPages: OrphanedPage[];
  stalePages: StalePage[];
  draftBacklog: DraftPage[];
  neverPublished: DraftPage[];
}

// Referrer Stats
export interface ReferrerStats {
  domain: string;
  viewCount: number;
  percentage: number;
}

export interface ReferrerStatsResponse {
  data: ReferrerStats[];
  meta: {
    limit: number;
    period: string;
  };
}
