import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AuthService } from './auth.service';
import {
  Dependencia,
  CrearDependencia,
  EditarDependencia,
  UnidadConDependencia,
  CrearUnidad,
  EditarUnidad,
} from '../models';

@Injectable({ providedIn: 'root' })
export class UnidadService {
  private readonly auth = inject(AuthService);

  // Dependencias
  async listarDependencias(): Promise<Dependencia[]> {
    return invoke<Dependencia[]>('listar_dependencias', {
      token: this.auth.getToken(),
    });
  }

  async crearDependencia(data: CrearDependencia): Promise<Dependencia> {
    return invoke<Dependencia>('crear_dependencia', {
      token: this.auth.getToken(),
      data,
    });
  }

  async editarDependencia(id: string, data: EditarDependencia): Promise<Dependencia> {
    return invoke<Dependencia>('editar_dependencia', {
      token: this.auth.getToken(),
      id,
      data,
    });
  }

  // Unidades Organizacionales
  async listarUnidades(): Promise<UnidadConDependencia[]> {
    return invoke<UnidadConDependencia[]>('listar_unidades', {
      token: this.auth.getToken(),
    });
  }

  async crearUnidad(data: CrearUnidad): Promise<UnidadConDependencia> {
    return invoke<UnidadConDependencia>('crear_unidad', {
      token: this.auth.getToken(),
      data,
    });
  }

  async editarUnidad(id: string, data: EditarUnidad): Promise<UnidadConDependencia> {
    return invoke<UnidadConDependencia>('editar_unidad', {
      token: this.auth.getToken(),
      id,
      data,
    });
  }
}
