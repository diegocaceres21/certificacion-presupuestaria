export interface LoginRequest {
  usuario: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  usuario: string;
  nombre_completo: string;
  cargo: string;
  rol: Rol;
}

export interface Claims {
  sub: string;
  rol: string;
  nombre: string;
  exp: number;
}

export type Rol = 'administrador' | 'encargado' | 'lector';
