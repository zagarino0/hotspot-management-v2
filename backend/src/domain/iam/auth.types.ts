export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthPermission {
  id: string;
  name: string;
  code: string;
  resource: string;
  action: string;
}

export interface AuthRole {
  id: string;
  name: string;
  code: string;
  permissions: AuthPermission[];
}

export interface AuthUser {
  id: string;
  organizationId: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  roles: AuthRole[];
}

export interface AuthTokenPayload {
  sub: string;
  organizationId: string;
  username: string;
}