export interface Proyecto {
  id: string;
  nombre: string;
  descripcion: string | null;
  pei: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrearProyecto {
  nombre: string;
  descripcion?: string;
  pei?: string;
}

export interface EditarProyecto {
  nombre?: string;
  descripcion?: string;
  pei?: string;
  activo?: boolean;
}
