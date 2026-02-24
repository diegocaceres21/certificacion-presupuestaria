import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AuthService } from './auth.service';
import { Proyecto, CrearProyecto, EditarProyecto } from '../models';

@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private readonly auth = inject(AuthService);

  async listar(): Promise<Proyecto[]> {
    return invoke<Proyecto[]>('listar_proyectos', {
      token: this.auth.getToken(),
    });
  }

  async crear(data: CrearProyecto): Promise<Proyecto> {
    return invoke<Proyecto>('crear_proyecto', {
      token: this.auth.getToken(),
      data,
    });
  }

  async editar(id: string, data: EditarProyecto): Promise<Proyecto> {
    return invoke<Proyecto>('editar_proyecto', {
      token: this.auth.getToken(),
      id,
      data,
    });
  }
}
