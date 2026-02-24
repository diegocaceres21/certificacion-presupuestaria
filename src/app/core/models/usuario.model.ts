export interface UsuarioConPerfil {
  id: string;
  usuario: string;
  activo: boolean;
  nombre_completo: string;
  cargo: string;
  rol: string;
}

export interface CrearUsuario {
  usuario: string;
  password: string;
  nombre_completo: string;
  cargo: string;
  rol: string;
}

export interface EditarUsuario {
  nombre_completo?: string;
  cargo?: string;
  rol?: string;
  activo?: boolean;
}
