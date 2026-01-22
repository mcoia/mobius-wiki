// Library Staff User (managed by mobius_staff)
export interface LibraryStaffUser {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  libraryId: number;
  libraryName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLibraryStaffRequest {
  email: string;
  name: string;
  password: string;
  libraryId: number;
}

export interface UpdateLibraryStaffRequest {
  email?: string;
  name?: string;
  isActive?: boolean;
  libraryId?: number;
}

// Library
export interface Library {
  id: number;
  name: string;
  slug: string;
  staffCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLibraryRequest {
  name: string;
  slug: string;
}

export interface UpdateLibraryRequest {
  name?: string;
  slug?: string;
}

// Access Rule
export interface AccessRule {
  id: number;
  ruleableType: 'wiki' | 'section' | 'page' | 'file';
  ruleableId: number;
  ruleableName: string | null;
  ruleType: string;
  ruleValue: string | null;
  createdAt: string;
  createdBy: number | null;
  createdByName: string | null;
}
