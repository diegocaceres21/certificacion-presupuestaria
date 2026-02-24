import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AuthService } from './auth.service';
import { CuentaContable, CuentaContableDetalle, CrearCuenta, EditarCuenta } from '../models';

@Injectable({ providedIn: 'root' })
export class CuentaService {
  private readonly auth = inject(AuthService);

  async listar(): Promise<CuentaContableDetalle[]> {
    return invoke<CuentaContableDetalle[]>('listar_cuentas', {
      token: this.auth.getToken(),
    });
  }

  async crear(data: CrearCuenta): Promise<CuentaContable> {
    return invoke<CuentaContable>('crear_cuenta', {
      token: this.auth.getToken(),
      data,
    });
  }

  async editar(id: string, data: EditarCuenta): Promise<CuentaContable> {
    return invoke<CuentaContable>('editar_cuenta', {
      token: this.auth.getToken(),
      id,
      data,
    });
  }
}
