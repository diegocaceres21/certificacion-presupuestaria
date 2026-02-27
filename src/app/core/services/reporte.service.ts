import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AuthService } from './auth.service';
import { ReporteCompleto, FiltrosReporte, DetalleUnidadPorCuenta, DetalleCuentaPorUnidad } from '../models';

@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly auth = inject(AuthService);

  async obtener(filtros?: FiltrosReporte): Promise<ReporteCompleto> {
    return invoke<ReporteCompleto>('obtener_reporte', {
      token: this.auth.getToken(),
      filtros: filtros ?? null,
    });
  }

  async detalleUnidad(idUnidad: string, filtros?: FiltrosReporte): Promise<DetalleUnidadPorCuenta[]> {
    return invoke<DetalleUnidadPorCuenta[]>('reporte_detalle_unidad', {
      token: this.auth.getToken(),
      idUnidad,
      filtros: filtros ?? null,
    });
  }

  async detalleCuenta(idCuenta: string, filtros?: FiltrosReporte): Promise<DetalleCuentaPorUnidad[]> {
    return invoke<DetalleCuentaPorUnidad[]>('reporte_detalle_cuenta', {
      token: this.auth.getToken(),
      idCuenta,
      filtros: filtros ?? null,
    });
  }
}
