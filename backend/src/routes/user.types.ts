export type UserStatus =
  | "ACTIVE"
  | "INVITED"
  | "SUSPENDED"
  | "DISABLED"
  | "ARCHIVED";

export interface UserRoleSummary {
  id: string;
  name: string;
  code: string;
}

export interface UserRow {
  id: string;
  organizationId: string;

  username: string;
  email: string | null;
  phone: string | null;

  firstName: string | null;
  lastName: string | null;

  status: UserStatus;

  emailVerified: boolean;

  lastLoginAt: Date | null;

  roles: UserRoleSummary[];

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  organizationId: string;

  username: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;

  password: string;

  status?: UserStatus;

  roleIds?: string[];
}

export interface UpdateUserData {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  status?: UserStatus;
  password?: string;
}
