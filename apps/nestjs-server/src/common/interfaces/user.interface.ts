export interface UserRole {
  id: string;
  name: string;
}

export interface UserPayload {
  id: string;
  roles: UserRole[];
}
