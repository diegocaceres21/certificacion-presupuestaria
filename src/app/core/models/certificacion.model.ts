export interface Certificacion {
  id: string;
  id_unidad: string;
  id_cuenta_contable: string;
  id_proyecto: string | null;
  generado_por: string;
  concepto: string;
  nro_certificacion: number;
  anio_certificacion: number;
  fecha_certificacion: string;
  monto_total: string;
  comentario: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CertificacionDetalle {
  id: string;
  nro_certificacion: number;
  anio_certificacion: number;
  fecha_certificacion: string;
  concepto: string;
  monto_total: string;
  comentario: string | null;
  unidad_codigo: number;
  unidad_nombre: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  proyecto_nombre: string | null;
  proyecto_descripcion: string | null;
  proyecto_pei: string | null;
  generado_por_id: string;
  generado_por_nombre: string;
  generado_por_cargo: string;
  created_at: string;
  updated_at: string;
}

export interface CrearCertificacion {
  id_unidad: string;
  id_cuenta_contable: string;
  id_proyecto?: string | null;
  concepto: string;
  monto_total: string;
  comentario?: string | null;
}

export interface EditarCertificacion {
  id_unidad?: string;
  id_cuenta_contable?: string;
  id_proyecto?: string | null;
  concepto?: string;
  monto_total?: string;
  comentario?: string | null;
}

export interface FiltrosCertificacion {
  id_unidad?: string;
  id_cuenta_contable?: string;
  id_proyecto?: string;
  generado_por?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  busqueda?: string;
}
