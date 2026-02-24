import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AuthService } from './auth.service';
import { ModificacionDetalle } from '../models';

@Injectable({ providedIn: 'root' })
export class ModificacionService {
  private readonly auth = inject(AuthService);

  async listar(idCertificacion: string): Promise<ModificacionDetalle[]> {
    return invoke<ModificacionDetalle[]>('listar_modificaciones', {
      token: this.auth.getToken(),
      idCertificacion,
    });
  }
}
