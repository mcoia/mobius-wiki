export interface User {
  id: number;
  email: string;
  name: string;
  role: 'guest' | 'library_staff' | 'mobius_staff' | 'site_admin';
  libraryId: number | null;
  library?: {
    id: number;
    name: string;
    code: string;
  };
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  data: {
    user: User;
  };
}
