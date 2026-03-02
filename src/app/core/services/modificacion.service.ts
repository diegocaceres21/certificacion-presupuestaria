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

  async crear(data: {
    id_certificacion: string;
    monto_antiguo?: string | null;
    monto_nuevo?: string | null;
    concepto_antiguo?: string | null;
    concepto_nuevo?: string | null;
    comentario?: string | null;
  }): Promise<void> {
    return invoke<void>('crear_modificacion', {
      token: this.auth.getToken(),
      data,
    });
  }
}
