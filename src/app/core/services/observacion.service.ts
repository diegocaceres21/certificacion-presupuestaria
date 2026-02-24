import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AuthService } from './auth.service';
import { ObservacionDetalle, CrearObservacion } from '../models';

@Injectable({ providedIn: 'root' })
export class ObservacionService {
  private readonly auth = inject(AuthService);

  async listar(idCertificacion: string): Promise<ObservacionDetalle[]> {
    return invoke<ObservacionDetalle[]>('listar_observaciones', {
      token: this.auth.getToken(),
      idCertificacion,
    });
  }

  async crear(data: CrearObservacion): Promise<ObservacionDetalle> {
    return invoke<ObservacionDetalle>('crear_observacion', {
      token: this.auth.getToken(),
      data,
    });
  }
}
