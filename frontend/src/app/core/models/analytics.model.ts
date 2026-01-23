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
