export interface Modificacion {
  id: string;
  id_certificacion: string;
  modificado_por: string;
  monto_antiguo: string | null;
  monto_nuevo: string | null;
  concepto_antiguo: string | null;
  concepto_nuevo: string | null;
  fecha_hora: string;
  comentario: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ModificacionDetalle {
  id: string;
  id_certificacion: string;
  modificado_por_nombre: string;
  monto_antiguo: string | null;
  monto_nuevo: string | null;
  concepto_antiguo: string | null;
  concepto_nuevo: string | null;
  fecha_hora: string;
  comentario: string | null;
}
