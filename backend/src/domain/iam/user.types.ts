export type UserStatus =
  | "ACTIVE"
  | "INVITED"
  | "SUSPENDED"
  | "DISABLED"
  | "ARCHIVED";

export interface User {
  id: string;

  organizationId: string;

  username: string;

  email?: string | null;

  phone?: string | null;

  firstName?: string | null;
  lastName?: string | null;

  passwordHash: string;

  status: UserStatus;

  emailVerified: boolean;

  lastLoginAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}