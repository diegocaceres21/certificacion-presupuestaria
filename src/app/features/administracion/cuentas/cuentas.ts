import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CuentaContableDetalle, TipoCuenta } from '../../../core/models';
import { CuentaService } from '../../../core/services/cuenta.service';
import { TipoCuentaService } from '../../../core/services/tipo-cuenta.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-cuentas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center">
        <h2>Cuentas Contables</h2>
        <button class="btn btn-primary" (click)="abrirModal()">+ Nueva Cuenta</button>
      </div>
      <div class="card-body" style="padding:0">
        <table class="data-table" aria-label="Cuentas contables">
          <thead>
            <tr>
              <th>Código</th>
              <th>Cuenta</th>
              <th>Tipo</th>
              <th>Cuenta Padre</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (c of cuentas(); track c.id) {
              <tr>
                <td>{{ c.codigo }}</td>
                <td>{{ c.cuenta }}</td>
                <td>{{ c.tipo_cuenta_nombre }}</td>
                <td>{{ c.cuenta_padre_nombre ? c.cuenta_padre_codigo + ' - ' + c.cuenta_padre_nombre : '—' }}</td>
                <td>
                  <span class="badge" [class.badge-active]="c.activo" [class.badge-inactive]="!c.activo">
                    {{ c.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  <button class="btn btn-sm" (click)="editar(c)">Editar</button>
                  <button class="btn btn-sm" (click)="toggleActivo(c)">
                    {{ c.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" style="text-align: center; padding: 2rem">No hay cuentas registradas.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (modalAbierto()) {
      <div class="modal-overlay" (click)="cerrarModal()" role="dialog" aria-modal="true" aria-label="Formulario de cuenta contable">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editandoId() ? 'Editar' : 'Nueva' }} Cuenta Contable</h3>
            <button class="btn-icon" (click)="cerrarModal()" aria-label="Cerrar">✕</button>
          </div>
          <div class="modal-body">
            <form [formGroup]="form" (ngSubmit)="guardar()">
              <div class="form-group">
                <label for="id_tipo_cuenta" class="form-label">Tipo de Cuenta *</label>
                <select id="id_tipo_cuenta" formControlName="id_tipo_cuenta" class="form-input">
                  <option value="">Seleccione un tipo</option>
                  @for (t of tiposCuenta(); track t.id) {
                    <option [value]="t.id">{{ t.tipo }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label for="id_cuenta_padre" class="form-label">Cuenta Padre</label>
                <select id="id_cuenta_padre" formControlName="id_cuenta_padre" class="form-input">
                  <option value="">Sin cuenta padre</option>
                  @for (c of cuentasPadre(); track c.id) {
                    <option [value]="c.id">{{ c.codigo }} - {{ c.cuenta }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label for="codigo" class="form-label">Código *</label>
                <input id="codigo" type="number" formControlName="codigo" class="form-input" />
              </div>
              <div class="form-group">
                <label for="cuenta" class="form-label">Nombre de Cuenta *</label>
                <input id="cuenta" type="text" formControlName="cuenta" class="form-input" />
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
export class Cuentas implements OnInit {
  private readonly svc = inject(CuentaService);
  private readonly tipoCuentaSvc = inject(TipoCuentaService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly cuentas = signal<CuentaContableDetalle[]>([]);
  protected readonly tiposCuenta = signal<TipoCuenta[]>([]);
  protected readonly cuentasPadre = signal<CuentaContableDetalle[]>([]);
  protected readonly modalAbierto = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    id_tipo_cuenta: ['', Validators.required],
    id_cuenta_padre: [''],
    codigo: [0, Validators.required],
    cuenta: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const [cuentas, tipos] = await Promise.all([
        this.svc.listar(),
        this.tipoCuentaSvc.listar(),
      ]);
      this.cuentas.set(cuentas);
      this.tiposCuenta.set(tipos.filter((t) => t.activo));
      this.cuentasPadre.set(cuentas.filter((c) => c.activo));
    } catch {
      this.toast.error('Error al cargar cuentas');
    }
  }

  protected abrirModal(): void {
    this.editandoId.set(null);
    this.form.reset({ id_tipo_cuenta: '', id_cuenta_padre: '', codigo: 0, cuenta: '' });
    this.modalAbierto.set(true);
  }

  protected editar(c: CuentaContableDetalle): void {
    this.editandoId.set(c.id);
    this.form.patchValue({
      id_tipo_cuenta: c.id_tipo_cuenta,
      id_cuenta_padre: c.id_cuenta_padre ?? '',
      codigo: c.codigo,
      cuenta: c.cuenta,
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
      const payload = {
        ...val,
        id_cuenta_padre: val.id_cuenta_padre || null,
      };
      if (this.editandoId()) {
        await this.svc.editar(this.editandoId()!, payload);
        this.toast.success('Cuenta actualizada');
      } else {
        await this.svc.crear(payload);
        this.toast.success('Cuenta creada');
      }
      this.cerrarModal();
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async toggleActivo(c: CuentaContableDetalle): Promise<void> {
    try {
      await this.svc.editar(c.id, { activo: !c.activo });
      this.toast.success(c.activo ? 'Cuenta desactivada' : 'Cuenta activada');
      await this.cargar();
    } catch (err) {
      this.toast.error(String(err));
    }
  }
}
