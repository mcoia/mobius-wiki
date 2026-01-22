export interface StaffUser {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStaffUserRequest {
  email: string;
  name: string;
  password: string;
}

export interface UpdateStaffUserRequest {
  email?: string;
  name?: string;
  isActive?: boolean;
}

export interface Setting {
  key: string;
  value: string;
  description: string;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSettingRequest {
  value: string;
}
