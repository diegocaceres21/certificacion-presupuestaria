import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AuthService } from './auth.service';
import { UsuarioConPerfil, CrearUsuario, EditarUsuario } from '../models';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly auth = inject(AuthService);

  async listar(): Promise<UsuarioConPerfil[]> {
    return invoke<UsuarioConPerfil[]>('listar_usuarios', {
      token: this.auth.getToken(),
    });
  }

  async listarSimple(): Promise<UsuarioConPerfil[]> {
    return invoke<UsuarioConPerfil[]>('listar_usuarios_simple', {
      token: this.auth.getToken(),
    });
  }

  async crear(data: CrearUsuario): Promise<UsuarioConPerfil> {
    return invoke<UsuarioConPerfil>('crear_usuario', {
      token: this.auth.getToken(),
      data,
    });
  }

  async editar(id: string, data: EditarUsuario): Promise<UsuarioConPerfil> {
    return invoke<UsuarioConPerfil>('editar_usuario', {
      token: this.auth.getToken(),
      id,
      data,
    });
  }

  async resetearPassword(id: string, nuevaPassword: string): Promise<string> {
    return invoke<string>('resetear_password', {
      token: this.auth.getToken(),
      id,
      nuevaPassword,
    });
  }
}
