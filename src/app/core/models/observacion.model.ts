export interface Observacion {
  id: string;
  id_certificacion: string;
  creado_por: string;
  comentario: string;
  created_at: string;
}

export interface ObservacionDetalle {
  id: string;
  id_certificacion: string;
  creado_por_nombre: string;
  comentario: string;
  created_at: string;
}

export interface CrearObservacion {
  id_certificacion: string;
  comentario: string;
}
