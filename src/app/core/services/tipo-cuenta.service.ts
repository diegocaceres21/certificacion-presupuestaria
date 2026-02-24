import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AuthService } from './auth.service';
import { TipoCuenta, CrearTipoCuenta, EditarTipoCuenta } from '../models';

@Injectable({ providedIn: 'root' })
export class TipoCuentaService {
  private readonly auth = inject(AuthService);

  async listar(): Promise<TipoCuenta[]> {
    return invoke<TipoCuenta[]>('listar_tipo_cuentas', {
      token: this.auth.getToken(),
    });
  }

  async crear(data: CrearTipoCuenta): Promise<TipoCuenta> {
    return invoke<TipoCuenta>('crear_tipo_cuenta', {
      token: this.auth.getToken(),
      data,
    });
  }

  async editar(id: string, data: EditarTipoCuenta): Promise<TipoCuenta> {
    return invoke<TipoCuenta>('editar_tipo_cuenta', {
      token: this.auth.getToken(),
      id,
      data,
    });
  }
}
