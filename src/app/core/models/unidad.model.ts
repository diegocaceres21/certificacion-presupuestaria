export interface Dependencia {
  id: string;
  codigo: string;
  dependencia: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrearDependencia {
  codigo: string;
  dependencia: string;
}

export interface EditarDependencia {
  codigo?: string;
  dependencia?: string;
  activo?: boolean;
}

export interface UnidadOrganizacional {
  id: string;
  id_dependencia: string;
  codigo: number;
  unidad: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnidadConDependencia {
  id: string;
  id_dependencia: string;
  codigo: number;
  unidad: string;
  activo: boolean;
  dependencia_codigo: string;
  dependencia_nombre: string;
}

export interface CrearUnidad {
  id_dependencia: string;
  codigo: number;
  unidad: string;
}

export interface EditarUnidad {
  id_dependencia?: string;
  codigo?: number;
  unidad?: string;
  activo?: boolean;
}
