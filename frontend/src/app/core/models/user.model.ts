export interface User {
  id: number;
  dni: string;
  nombre: string;
  rol: 'admin' | 'citizen';
  email_telefono?: string;
  created_at?: string;
  updated_at?: string;
  total_alertas?: number;
  alertas?: any[];
}

export interface AuthResponse {
  token: string;
  user: User;
  message?: string;
}


