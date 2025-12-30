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
}

export interface Page {
  id: number;
  section_id: number | null;
  title: string;
  slug: string;
  content: string;
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
  };
}
