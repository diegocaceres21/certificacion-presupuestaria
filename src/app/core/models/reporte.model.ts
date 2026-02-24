export interface ReporteResumen {
  total_certificaciones: number;
  monto_total: string | null;
}

export interface ReportePorUnidad {
  unidad_codigo: number;
  unidad_nombre: string;
  total_certificaciones: number;
  monto_total: string | null;
}

export interface ReportePorCuenta {
  cuenta_codigo: number;
  cuenta_nombre: string;
  total_certificaciones: number;
  monto_total: string | null;
}

export interface ReportePorProyecto {
  proyecto_nombre: string;
  total_certificaciones: number;
  monto_total: string | null;
}

export interface ReporteCompleto {
  resumen: ReporteResumen;
  por_unidad: ReportePorUnidad[];
  por_cuenta: ReportePorCuenta[];
  por_proyecto: ReportePorProyecto[];
}

export interface FiltrosReporte {
  fecha_desde?: string;
  fecha_hasta?: string;
  mes?: number;
  anio?: number;
}
