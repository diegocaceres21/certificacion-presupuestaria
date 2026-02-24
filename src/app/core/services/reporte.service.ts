import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AuthService } from './auth.service';
import { ReporteCompleto, FiltrosReporte } from '../models';

@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly auth = inject(AuthService);

  async obtener(filtros?: FiltrosReporte): Promise<ReporteCompleto> {
    return invoke<ReporteCompleto>('obtener_reporte', {
      token: this.auth.getToken(),
      filtros: filtros ?? null,
    });
  }
}
