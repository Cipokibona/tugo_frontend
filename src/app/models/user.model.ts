export interface User {
  id: number;
  username: string;
  email?: string;
  role: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
}
