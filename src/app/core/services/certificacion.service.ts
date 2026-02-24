import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AuthService } from './auth.service';
import {
  CertificacionDetalle,
  CrearCertificacion,
  EditarCertificacion,
  FiltrosCertificacion,
} from '../models';

@Injectable({ providedIn: 'root' })
export class CertificacionService {
  private readonly auth = inject(AuthService);

  async listar(filtros?: FiltrosCertificacion): Promise<CertificacionDetalle[]> {
    return invoke<CertificacionDetalle[]>('listar_certificaciones', {
      token: this.auth.getToken(),
      filtros: filtros ?? null,
    });
  }

  async obtener(id: string): Promise<CertificacionDetalle> {
    return invoke<CertificacionDetalle>('obtener_certificacion', {
      token: this.auth.getToken(),
      id,
    });
  }

  async crear(data: CrearCertificacion): Promise<CertificacionDetalle> {
    return invoke<CertificacionDetalle>('crear_certificacion', {
      token: this.auth.getToken(),
      data,
    });
  }

  async editar(id: string, data: EditarCertificacion): Promise<CertificacionDetalle> {
    return invoke<CertificacionDetalle>('editar_certificacion', {
      token: this.auth.getToken(),
      id,
      data,
    });
  }

  async eliminar(id: string): Promise<string> {
    return invoke<string>('eliminar_certificacion', {
      token: this.auth.getToken(),
      id,
    });
  }
}
