import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Proyecto } from '../../../core/models';
import { ProyectoService } from '../../../core/services/proyecto.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-proyectos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center">
        <h2>Proyectos</h2>
        <button class="btn btn-primary" (click)="abrirModal()">+ Nuevo Proyecto</button>
      </div>
      <div class="card-body" style="padding:0">
        <table class="data-table" aria-label="Proyectos">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>PEI</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (p of proyectos(); track p.id) {
              <tr>
                <td>{{ p.nombre }}</td>
                <td>{{ p.descripcion ?? '—' }}</td>
                <td>{{ p.pei ?? '—' }}</td>
                <td>
                  <span class="badge" [class.badge-active]="p.activo" [class.badge-inactive]="!p.activo">
                    {{ p.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  <button class="btn btn-sm" (click)="editar(p)">Editar</button>
                  <button class="btn btn-sm" (click)="toggleActivo(p)">
                    {{ p.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" style="text-align: center; padding: 2rem">No hay proyectos registrados.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (modalAbierto()) {
      <div class="modal-overlay" (click)="cerrarModal()" role="dialog" aria-modal="true" aria-label="Formulario de proyecto">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editandoId() ? 'Editar' : 'Nuevo' }} Proyecto</h3>
            <button class="btn-icon" (click)="cerrarModal()" aria-label="Cerrar">✕</button>
          </div>
          <div class="modal-body">
            <form [formGroup]="form" (ngSubmit)="guardar()">
              <div class="form-group">
                <label for="nombre" class="form-label">Nombre *</label>
                <input id="nombre" type="text" formControlName="nombre" class="form-input" />
              </div>
              <div class="form-group">
                <label for="descripcion" class="form-label">Descripción</label>
                <textarea id="descripcion" formControlName="descripcion" class="form-input" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label for="pei" class="form-label">PEI</label>
                <input id="pei" type="text" formControlName="pei" class="form-input" placeholder="Ej: PEI-2024-001" />
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="cerrarModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary" [disabled]="form.invalid || guardando()">
                  {{ guardando() ? 'Guardando...' : 'Guardar' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .badge { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-inactive { background: #fee2e2; color: #991b1b; }
  `,
})
export class Proyectos implements OnInit {
  private readonly svc = inject(ProyectoService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly proyectos = signal<Proyecto[]>([]);
  protected readonly modalAbierto = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    descripcion: [''],
    pei: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.proyectos.set(await this.svc.listar());
    } catch {
      this.toast.error('Error al cargar proyectos');
    }
  }

  protected abrirModal(): void {
    this.editandoId.set(null);
    this.form.reset({ nombre: '', descripcion: '', pei: '' });
    this.modalAbierto.set(true);
  }

  protected editar(p: Proyecto): void {
    this.editandoId.set(p.id);
    this.form.patchValue({
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      pei: p.pei ?? '',
    });
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid) return;
    this.guardando.set(true);
    const val = this.form.getRawValue();
    try {
      if (this.editandoId()) {
        await this.svc.editar(this.editandoId()!, {
          nombre: val.nombre,
          descripcion: val.descripcion || undefined,
          pei: val.pei || undefined,
        });
        this.toast.success('Proyecto actualizado');
      } else {
        await this.svc.crear({
          nombre: val.nombre,
          descripcion: val.descripcion || undefined,
          pei: val.pei || undefined,
        });
        this.toast.success('Proyecto creado');
      }
      this.cerrarModal();
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async toggleActivo(p: Proyecto): Promise<void> {
    try {
      await this.svc.editar(p.id, { activo: !p.activo });
      this.toast.success(p.activo ? 'Proyecto desactivado' : 'Proyecto activado');
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    }
  }
}
