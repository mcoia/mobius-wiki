export interface Wiki {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
  deleted_at: string | null;
  deleted_by: number | null;
  archived_at: string | null;
}

export interface Section {
  id: number;
  wiki_id: number;
  title: string;
  slug: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
  deleted_at: string | null;
  deleted_by: number | null;
}

export interface Page {
  id: number;
  section_id: number | null;
  title: string;
  slug: string;
  content: string;
  scripts: string | null;
  allow_scripts: boolean;
  status: string;
  sort_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
  deleted_at: string | null;
  deleted_by: number | null;
  wiki?: {
    title: string;
    slug: string;
  };
  section?: {
    title: string;
    slug: string;
  } | null;
  author?: {
    id: number;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  // Version metadata (added by backend getVisibleVersion)
  publishedVersionNumber?: number;
  currentVersionNumber?: number;
  isViewingDraft?: boolean;
  hasDraft?: boolean;
}

export interface PageVersion {
  id: number;
  page_id: number;
  version_number: number;
  title: string;
  content: string;
  scripts: string | null;
  created_at: string;
  created_by: number | null;
  author_name: string | null;
}

// Navigation tree interfaces (for left sidebar)
export interface NavPage {
  id: number;
  title: string;
  slug: string;
  status: string;
  canEdit: boolean;
}

export interface NavSection {
  id: number;
  title: string;
  slug: string;
  pages: NavPage[];
}

export interface NavWiki {
  id: number;
  title: string;
  slug: string;
  sections: NavSection[];
}

export interface NavTree {
  wikis: NavWiki[];
}
